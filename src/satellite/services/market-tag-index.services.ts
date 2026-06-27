import { Collection } from '$lib/constants/collections.constants';
import {
	isMarketTag,
	MARKET_TAGS,
	normalizeMarketTags,
	type MarketTag
} from '$lib/constants/market-tags.constants';
import type { MarketMetadata, MarketTagIndex } from '$lib/types/market-metadata';
import { isAdmin } from '$satellite/services/_authz';
import { logError } from '$satellite/utils/logger.utils';
import { isNullish, nonNullish } from '@dfinity/utils';
import { msgCaller, time } from '@junobuild/functions/ic-cdk';
import {
	decodeDocData,
	encodeDocData,
	getAdminAccessKeys,
	getDocStore,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';

/**
 * Server-side reverse index `market tag → seriesId[]`, one doc per tag of the
 * closed {@link MARKET_TAGS} taxonomy keyed by the tag id. It exists so battle
 * scoping ({@link seriesIdsForTag}) reads a single bucket instead of scanning
 * the whole `market_metadata` collection on every resolve / live-standings
 * read. The buckets are maintained inline by `upsertMarketMetadata` (Juno hooks
 * don't fire on serverless `setDocStore`, so the upsert endpoint diffs a
 * market's old vs new tags and updates the affected buckets itself) and can be
 * rebuilt from scratch by the admin {@link rebuildMarketTagIndexFn}.
 */

const MS_PER_NS = 1_000_000n;

const nowMs = (): number => Number(time() / MS_PER_NS);

/**
 * A satellite controller principal, used as the `caller` for writes to the
 * controllers-scoped `market_tag_index` collection — the market creator is not
 * a controller, so the index is moved as an admin (the `*DocStore` APIs enforce
 * the collection rule against the caller they're given).
 */
const adminCaller = (): Uint8Array => {
	const first = getAdminAccessKeys()[0]?.[0];

	if (isNullish(first)) {
		throw new Error('No satellite controller available for market-tag index.');
	}

	return first;
};

const decodeSeriesIds = (doc: ReturnType<typeof getDocStore>): string[] => {
	if (isNullish(doc)) {
		return [];
	}

	try {
		return decodeDocData<MarketTagIndex>(doc.data).seriesIds;
	} catch {
		// A malformed bucket can't contribute series — treat as empty.
		return [];
	}
};

/**
 * The series carrying `tag`, read straight from its index bucket. Returns an
 * empty array when no bucket exists yet (no market has the tag, or the index
 * hasn't been rebuilt) — which correctly scores a battle on that scope as a
 * void face-off rather than silently counting every market.
 */
export const seriesIdsForTag = ({
	tag,
	caller
}: {
	tag: MarketTag;
	caller: Uint8Array;
}): string[] => {
	const doc = getDocStore({
		collection: Collection.MARKET_TAG_INDEX,
		key: tag,
		caller
	});

	return decodeSeriesIds(doc);
};

/**
 * Add or remove `seriesId` from a single tag's bucket. Version-locked
 * read-modify-write as admin; best-effort — a rare version race under
 * concurrent metadata writes to markets sharing a tag is logged and swallowed
 * (the admin {@link rebuildMarketTagIndexFn} re-derives the exact buckets).
 */
const mutateBucket = ({
	tag,
	seriesId,
	op,
	admin
}: {
	tag: MarketTag;
	seriesId: string;
	op: 'add' | 'remove';
	admin: Uint8Array;
}): void => {
	try {
		const existing = getDocStore({
			collection: Collection.MARKET_TAG_INDEX,
			key: tag,
			caller: admin
		});

		const current = decodeSeriesIds(existing);
		const set = new Set(current);

		if (op === 'add') {
			set.add(seriesId);
		} else {
			set.delete(seriesId);
		}

		// Nothing changed — skip the write (and its version bump) entirely.
		if (set.size === current.length && current.every((id) => set.has(id))) {
			return;
		}

		const next: MarketTagIndex = {
			tag,
			seriesIds: [...set],
			updatedAtMs: nowMs()
		};

		setDocStore({
			collection: Collection.MARKET_TAG_INDEX,
			key: tag,
			caller: admin,
			doc: {
				data: encodeDocData(next),
				version: existing?.version
			}
		});
	} catch (err: unknown) {
		logError({
			message: 'market_tag_index_bucket_failed',
			detail: { tag, seriesId, op, error: err instanceof Error ? err.message : `${err}` }
		});
	}
};

/**
 * Reconcile the index for a single market after its metadata is (re-)written:
 * drop the series from every tag it no longer carries and add it to every tag
 * it newly carries. Tags it still carries are left untouched (the series is
 * already in those buckets). Both inputs are normalized to the closed taxonomy
 * here so no unknown tag reaches a bucket and a since-removed tag is dropped.
 */
export const updateMarketTagIndex = ({
	seriesId,
	oldTags,
	newTags
}: {
	seriesId: string;
	oldTags: readonly string[];
	newTags: readonly string[];
}): void => {
	const previous = normalizeMarketTags(oldTags);
	const current = normalizeMarketTags(newTags);

	const removed = previous.filter((tag) => !current.includes(tag));
	const added = current.filter((tag) => !previous.includes(tag));

	if (removed.length === 0 && added.length === 0) {
		return;
	}

	// Index maintenance is best-effort: it must never trap the primary metadata
	// write (a trap would roll the whole upsert back). A missing controller is
	// logged and swallowed; the admin `rebuildMarketTagIndex` re-derives buckets.
	try {
		const admin = adminCaller();

		for (const tag of removed) {
			mutateBucket({ tag, seriesId, op: 'remove', admin });
		}

		for (const tag of added) {
			mutateBucket({ tag, seriesId, op: 'add', admin });
		}
	} catch (err: unknown) {
		logError({
			message: 'market_tag_index_update_failed',
			detail: { seriesId, error: err instanceof Error ? err.message : `${err}` }
		});
	}
};

/**
 * Admin-only corrective: re-derive every tag bucket from a single scan of
 * `market_metadata` and overwrite the index. Backfills the index for markets
 * that predate it and heals any drift from a concurrent-write version race.
 * Admin-gated (mirrors `recomputeActivityReactionCounts`).
 *
 * One pass over `market_metadata` — fine at current volume; this is the only
 * O(all-markets) read in the index's life, run on demand rather than per
 * resolve.
 */
export const rebuildMarketTagIndexFn = (): { buckets: number; series: number } => {
	const caller = msgCaller();

	if (!isAdmin({ caller })) {
		throw new Error('Only an admin can rebuild the market-tag index.');
	}

	const admin = adminCaller();

	const { items } = listDocsStore({
		collection: Collection.MARKET_METADATA,
		caller: admin,
		params: {}
	});

	const buckets = new Map<MarketTag, string[]>(MARKET_TAGS.map((tag) => [tag, []]));
	let series = 0;

	for (const [, item] of items) {
		let metadata: MarketMetadata | undefined;

		try {
			metadata = decodeDocData<MarketMetadata>(item.data);
		} catch {
			// Skip an undecodable metadata row.
			metadata = undefined;
		}

		if (nonNullish(metadata)) {
			series += 1;

			for (const tag of metadata.tags) {
				// `tags` is persisted normalized, but guard against an unknown value
				// so a stray tag can't create a bucket outside the taxonomy.
				if (isMarketTag(tag)) {
					buckets.get(tag)?.push(metadata.seriesId);
				}
			}
		}
	}

	const now = nowMs();

	// Reconcile every tag bucket — including ones that now resolve to empty, so
	// a stale membership is cleared rather than left behind.
	for (const tag of MARKET_TAGS) {
		const seriesIds = buckets.get(tag) ?? [];

		const existing = getDocStore({
			collection: Collection.MARKET_TAG_INDEX,
			key: tag,
			caller: admin
		});

		const next: MarketTagIndex = { tag, seriesIds, updatedAtMs: now };

		setDocStore({
			collection: Collection.MARKET_TAG_INDEX,
			key: tag,
			caller: admin,
			doc: {
				data: encodeDocData(next),
				version: existing?.version
			}
		});
	}

	return { buckets: MARKET_TAGS.length, series };
};
