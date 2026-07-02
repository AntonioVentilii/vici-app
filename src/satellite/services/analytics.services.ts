/**
 * Product-analytics capture + read (cockpit DQ-1).
 *
 * Two `defineUpdate` / `defineQuery` endpoints, wired in `src/satellite/index.ts`:
 *
 *   trackEvents({ events }) -> { accepted }
 *     · the FE batches behavioural events and flushes them here
 *     · the server stamps the authoritative timestamp and derives the
 *       pseudonymous `principal` from the caller (anonymous before sign-in)
 *     · writes one append-only doc per event to `events`
 *     · best-effort bumps the day's `event_rollups` counter doc inline
 *       (a rollup failure never blocks event capture)
 *
 *   getAnalyticsSummary({ days }) -> { rows: [{ day, start, name, count }] }
 *     · admin-gated (the cockpit's founder principal)
 *     · returns the trailing `days` daily rollups, flattened to rows
 *
 * Both `events` and `event_rollups` are controllers-scoped collections, so
 * the privileged `*DocStore` APIs run as an admin (the invoking user is not
 * a controller). Bodies are behavioural only — never PII; the only identity
 * stored is the principal, which is pseudonymous and never leaves the
 * satellite.
 */

import { ZERO } from '$lib/constants/app.constants';
import { Collection } from '$lib/constants/collections.constants';
import {
	ANALYTICS_PROP_KEYS,
	type AnalyticsEventDoc,
	type AnalyticsEventName,
	type AnalyticsEventProps,
	type EventCount,
	type EventRollupDoc,
	type TrackEventInput
} from '$lib/types/analytics-event';
import { isAdmin } from '$satellite/services/_authz';
import { logError } from '$satellite/utils/logger.utils';
import { isNullish, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import { msgCaller, time } from '@junobuild/functions/ic-cdk';
import {
	decodeDocData,
	encodeDocData,
	getAdminAccessKeys,
	getDocStore,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';

const MS_PER_NS = 1_000_000n;
const MS_PER_DAY = 86_400_000;

/** Defensive cap so one call can't write an unbounded number of docs. */
const MAX_EVENTS_PER_BATCH = 100;

const nowMs = (): number => Number(time() / MS_PER_NS);

/**
 * Re-nest the flat wire dimensions back into a `props` object, dropping
 * undefined keys. Returns `undefined` when no dimension was set so the
 * stored doc stays lean.
 */
const propsFromInput = (event: TrackEventInput): AnalyticsEventProps | undefined => {
	const props: AnalyticsEventProps = {};
	let present = false;

	const copy = <K extends keyof AnalyticsEventProps>(key: K): void => {
		const value = event[key];

		if (nonNullish(value)) {
			props[key] = value;
			present = true;
		}
	};

	ANALYTICS_PROP_KEYS.forEach((key) => copy(key));

	return present ? props : undefined;
};

/**
 * A satellite controller principal, used as the `caller` for the
 * server-owned, controllers-scoped analytics collections. The `*DocStore`
 * APIs enforce the collection rule against the `caller` they're given, and
 * the end user is not a controller — so we read/write as an admin.
 */
const adminCaller = (): Uint8Array => {
	const first = getAdminAccessKeys()[0]?.[0];

	if (isNullish(first)) {
		throw new Error('No satellite controller available for analytics capture.');
	}

	return first;
};

/**
 * Best-effort inline rollup. Bumps the day's per-event-name counts so the
 * cockpit reads cheap aggregates. Wrapped so any failure (e.g. a rare
 * version race under concurrent writes) is logged and swallowed — the raw
 * `events` log is the source of truth and must never be blocked by this.
 */
const bumpRollup = ({
	admin,
	tsMs,
	names
}: {
	admin: Uint8Array;
	tsMs: number;
	names: AnalyticsEventName[];
}): void => {
	try {
		const epochDay = Math.floor(tsMs / MS_PER_DAY);
		const key = `${epochDay}`;

		const current = getDocStore({
			collection: Collection.EVENT_ROLLUPS,
			key,
			caller: admin
		});

		const existing = isNullish(current) ? undefined : decodeDocData<EventRollupDoc>(current.data);

		const counts: Record<string, number> = {};
		existing?.counts.forEach(({ name, count }) => {
			counts[name] = count;
		});
		names.forEach((name) => {
			counts[name] = (counts[name] ?? 0) + 1;
		});

		const rollup: EventRollupDoc = {
			epochDay,
			dayStartMs: epochDay * MS_PER_DAY,
			counts: Object.keys(counts).map(
				(name): EventCount => ({ name: name as AnalyticsEventName, count: counts[name] })
			),
			updatedAtMs: tsMs
		};

		setDocStore({
			collection: Collection.EVENT_ROLLUPS,
			key,
			caller: admin,
			doc: {
				version: current?.version,
				data: encodeDocData<EventRollupDoc>(rollup)
			}
		});
	} catch (err) {
		logError({
			message: 'analytics rollup bump failed (events still captured)',
			detail: { error: err instanceof Error ? err.message : `${err}` }
		});
	}
};

export const trackEventsFn = ({ events }: { events: TrackEventInput[] }): { accepted: number } => {
	if (events.length === 0) {
		return { accepted: 0 };
	}

	const batch = events.slice(0, MAX_EVENTS_PER_BATCH);

	const caller = msgCaller();
	const principalText = caller.toText();
	const isAnonymous = principalText === Principal.anonymous().toText();
	const admin = adminCaller();
	const tsMs = nowMs();
	const stamp = time();

	batch.forEach((event, index) => {
		const props = propsFromInput(event);
		const doc: AnalyticsEventDoc = {
			name: event.name,
			tsMs,
			sessionId: event.sessionId,
			...(isAnonymous ? {} : { principal: principalText }),
			...(isNullish(event.path) ? {} : { path: event.path }),
			...(isNullish(props) ? {} : { props })
		};

		// Key is unique within the batch (index) and across callers/calls
		// (ns stamp + sessionId); the collection is append-only.
		setDocStore({
			collection: Collection.EVENTS,
			key: `${stamp}-${event.sessionId}-${index}`,
			caller: admin,
			doc: {
				data: encodeDocData<AnalyticsEventDoc>(doc)
			}
		});
	});

	bumpRollup({ admin, tsMs, names: batch.map(({ name }) => name) });

	return { accepted: batch.length };
};

/** One flat `(day, name, count)` row in the summary result. */
interface SummaryRow {
	day: number;
	start: number;
	name: AnalyticsEventName;
	count: number;
}

export const getAnalyticsSummaryFn = ({ days }: { days: number }): { rows: SummaryRow[] } => {
	const caller = msgCaller();

	if (!isAdmin({ caller })) {
		throw new Error('Analytics is restricted to admins.');
	}

	const admin = adminCaller();

	const { items } = listDocsStore({
		collection: Collection.EVENT_ROLLUPS,
		caller: admin,
		params: {}
	});

	const rollups: EventRollupDoc[] = [];
	items.forEach(([, doc]) => {
		try {
			rollups.push(decodeDocData<EventRollupDoc>(doc.data));
		} catch (err) {
			logError({
				message: 'analytics rollup decode failed',
				detail: { error: err instanceof Error ? err.message : `${err}` }
			});
		}
	});

	const trimmed = rollups
		.sort((a, b) => b.epochDay - a.epochDay)
		.slice(0, Math.max(0, Math.floor(days)));

	const rows: SummaryRow[] = [];
	trimmed.forEach(({ epochDay, dayStartMs, counts }) => {
		counts.forEach(({ name, count }: EventCount) => {
			rows.push({ day: epochDay, start: dayStartMs, name, count });
		});
	});

	return { rows };
};

/** Page-size cap so one export call can't scan/return an unbounded set. */
const MAX_EXPORT_LIMIT = 1000;

/** One flat export row — mirrors AnalyticsEventExportRowSchema. */
interface AnalyticsEventExportRow {
	key: string;
	createdAtNs: string;
	updatedAtNs: string;
	version?: string;
	ownerText?: string;
	name: AnalyticsEventName;
	tsMs: number;
	sessionId: string;
	principalText?: string;
	path?: string;
	marketId?: string;
	seriesId?: string;
	leagueId?: string;
	battleId?: string;
	source?: string;
	label?: string;
	step?: number;
	value?: number;
	count?: number;
	durationMs?: number;
	ok?: boolean;
}

/** Parse the exclusive `updated_at` cursor. Tolerates absent/whitespace/
 * non-numeric input by restarting from the beginning rather than throwing a
 * low-signal BigInt error on a malformed cursor. */
const parseCursorNs = (raw?: string): bigint => {
	const trimmed = raw?.trim() ?? '';

	return /^\d+$/.test(trimmed) ? BigInt(trimmed) : -1n;
};

/**
 * Admin-gated raw-event export for the cockpit warehouse. Returns the next page
 * of `events` ordered by `(updated_at, key)`, flattened, strictly after the
 * `(afterUpdatedAtNs, afterKey)` keyset cursor. The `key` tie-breaker is what
 * makes a page boundary that splits a group of same-`updated_at` docs safe — the
 * next call resumes mid-group instead of skipping the rest. The cockpit advances
 * the cursor from the last returned row's `(updatedAtNs, key)`. "List then
 * process in code" mirrors `getAnalyticsSummaryFn`.
 */
export const getAnalyticsEventsFn = ({
	afterUpdatedAtNs,
	afterKey,
	limit
}: {
	afterUpdatedAtNs?: string;
	afterKey?: string;
	limit: number;
}): { rows: AnalyticsEventExportRow[]; hasMore: boolean } => {
	const caller = msgCaller();

	if (!isAdmin({ caller })) {
		throw new Error('Analytics is restricted to admins.');
	}

	const admin = adminCaller();

	const afterNs = parseCursorNs(afterUpdatedAtNs);
	const afterKeyText = afterKey?.trim() ?? '';
	const safeLimit = Number.isFinite(limit) ? Math.floor(limit) : MAX_EXPORT_LIMIT;
	const cap = Math.min(Math.max(1, safeLimit), MAX_EXPORT_LIMIT);

	// Page by KEY only — the datastore's native (indexed) order. Event keys are
	// `${ns}-${sessionId}-${index}` (ns from `time()` at write) and the collection is
	// append-only, so key order IS chronological order; no `order`/`matcher` on
	// `updated_at` is needed. Those non-key params were the bug: the datastore has no
	// secondary index on `updated_at`, so ordering/matching on it forced Juno to load
	// and sort the ENTIRE `events` collection on every call, blowing the 5B-instruction
	// query budget once the collection grew (IC0522 — even at limit=1). `start_after`
	// on the unique key is a complete keyset cursor, and `paginate.limit` bounds the
	// walk to a single page, so the scan + response stay O(page), not O(collection).
	const { items } = listDocsStore({
		collection: Collection.EVENTS,
		caller: admin,
		params: {
			paginate: {
				limit: BigInt(cap),
				start_after: afterKeyText.length > 0 ? afterKeyText : undefined
			}
		}
	});

	const ordered = items
		.filter(([key, doc]) => {
			const u = doc.updated_at ?? ZERO;

			return u === afterNs ? key > afterKeyText : u > afterNs;
		})
		.sort(([ak, ad], [bk, bd]) => {
			const au = ad.updated_at ?? ZERO;
			const bu = bd.updated_at ?? ZERO;

			if (au !== bu) {
				return au < bu ? -1 : 1;
			}

			return ak < bk ? -1 : ak > bk ? 1 : 0;
		});

	const page = ordered.slice(0, cap);

	const rows = page.map(([key, doc]): AnalyticsEventExportRow => {
		const data = decodeDocData<AnalyticsEventDoc>(doc.data);
		const p = data.props ?? {};

		return {
			key,
			createdAtNs: `${doc.created_at ?? ZERO}`,
			updatedAtNs: `${doc.updated_at ?? ZERO}`,
			version: isNullish(doc.version) ? undefined : `${doc.version}`,
			ownerText: isNullish(doc.owner) ? undefined : Principal.fromUint8Array(doc.owner).toText(),
			name: data.name,
			tsMs: data.tsMs,
			sessionId: data.sessionId,
			principalText: data.principal,
			path: data.path,
			marketId: p.marketId,
			seriesId: p.seriesId,
			leagueId: p.leagueId,
			battleId: p.battleId,
			source: p.source,
			label: p.label,
			step: p.step,
			value: p.value,
			count: p.count,
			durationMs: p.durationMs,
			ok: p.ok
		};
	});

	// A full datastore page means there may be more. `start_after` already excluded
	// the cursor's own key, so the fetched count is the unseen-row count — compare it
	// to `cap` directly (the keyset filter above is a no-op safety net unless the
	// cursor doc was deleted mid-pagination).
	return { rows, hasMore: items.length >= cap };
};
