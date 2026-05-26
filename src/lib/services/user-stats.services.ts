import type * as ClearingDid from '$declarations/clearing/clearing';
import { ZERO } from '$lib/constants/app.constants';
import { Collection } from '$lib/constants/collections.constants';
import { MARKET_TAGS, isMarketTag, type MarketTag } from '$lib/constants/market-tags.constants';
import type { MarketMetadata } from '$lib/types/market-metadata';
import {
	USER_STATS_RECENT_LIMIT,
	type CategoryStatsBucket,
	type RecentSettlementSnapshot,
	type UserStatsDoc
} from '$lib/types/user-stats';
import { getDoc, setDoc } from '@junobuild/core';
import type { PrincipalText } from '@junobuild/schema';

/**
 * FE service for the per-user dashboard cache. The cache is computed
 * from the user's clearing history + the in-memory market-metadata
 * store, then persisted to the `USER_STATS` collection so subsequent
 * Dash mounts can read it in a single `getDoc`.
 *
 * Compute path:
 *  1. `calculateAndSyncStats` finishes aggregating wins / totals.
 *  2. It hands the same `history` array to `computeUserStatsSnapshot`
 *     along with the market-metadata map.
 *  3. The result is `setDoc`'d under `USER_STATS[principal]`. The
 *     satellite assert restricts writes to the principal themselves,
 *     so the user can only update their own row.
 *
 * Read path:
 *  - `loadMyUserStats(principal)` resolves to `UserStatsDoc | undefined`.
 *    Returns `undefined` when no doc exists yet (the very first sync
 *    hasn't run).
 *
 * Slight refresh delay (per the design decision) — the Dash reads
 * whatever the last sync persisted; a market resolving moments before
 * mount won't show up until the next sync completes. Acceptable
 * trade-off for instant page loads.
 */

const emptyCategoryStats = (): Record<string, CategoryStatsBucket> => {
	const out: Record<string, CategoryStatsBucket> = {};

	for (const tag of MARKET_TAGS) {
		out[tag] = { calls: 0, wins: 0 };
	}

	return out;
};

const tagForSeries = ({
	seriesId,
	metadata
}: {
	seriesId: string;
	metadata: Record<string, MarketMetadata> | undefined;
}): MarketTag | '' => {
	const meta = metadata?.[seriesId];

	if (meta === undefined) {
		return '';
	}

	for (const tag of meta.tags) {
		if (isMarketTag(tag)) {
			return tag;
		}
	}

	return '';
};

/**
 * Build a `UserStatsDoc` payload from raw clearing history plus the
 * in-memory market-metadata map. Pure function — no IO.
 *
 *  - `calls` per category = settled trades where the user took a
 *    position in a market of that tag.
 *  - `wins` per category = settled trades the user won (qty > 0).
 *  - `recentSettlements` = the last {@link USER_STATS_RECENT_LIMIT}
 *    settlement events in chronological-descending order.
 */
export const computeUserStatsSnapshot = ({
	owner,
	history,
	metadata,
	nowMs
}: {
	owner: PrincipalText;
	history: ClearingDid.Event[];
	metadata: Record<string, MarketMetadata> | undefined;
	nowMs: number;
}): UserStatsDoc => {
	const categoryStats = emptyCategoryStats();

	const settled = history.filter((event) => 'Settled' in event.event_type);

	for (const event of settled) {
		const tag = tagForSeries({ seriesId: event.series_id, metadata });

		// Skip untagged markets (they aren't in any category bucket);
		// the categories tile only renders the known tags anyway.
		if (tag !== '') {
			const bucket = categoryStats[tag];
			bucket.calls += 1;

			if (event.qty > ZERO) {
				bucket.wins += 1;
			}
		}
	}

	// Recent settlements — newest first.
	const recentSettlements: RecentSettlementSnapshot[] = [...settled]
		.sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
		.slice(0, USER_STATS_RECENT_LIMIT)
		.map((event) => ({
			marketId: event.series_id,
			tag: tagForSeries({ seriesId: event.series_id, metadata }),
			win: event.qty > ZERO,
			settledAtMs: Number(event.timestamp / 1_000_000n)
		}));

	return {
		owner,
		categoryStats,
		recentSettlements,
		computedAtMs: nowMs
	};
};

/**
 * Persist a `UserStatsDoc` snapshot for the caller. Performs a
 * read-modify-write so the version stamp stays in lockstep with the
 * datastore; safe to call from `calculateAndSyncStats` on every
 * sync.
 *
 * Failures are logged and rethrown — the caller (`calculateAndSyncStats`)
 * already runs in a try/catch shape that surfaces partial failures
 * without aborting the wider profile sync.
 */
export const persistMyUserStats = async (snapshot: UserStatsDoc): Promise<void> => {
	const existing = await getDoc<UserStatsDoc>({
		collection: Collection.USER_STATS,
		key: snapshot.owner
	});

	await setDoc<UserStatsDoc>({
		collection: Collection.USER_STATS,
		doc: {
			key: snapshot.owner,
			data: snapshot,
			version: existing?.version
		}
	});
};

/**
 * Load the caller's dashboard cache. Returns `undefined` when no
 * snapshot exists yet — the FE renders a "pull-to-refresh" hint in
 * that branch.
 */
export const loadMyUserStats = async (
	principal: PrincipalText
): Promise<UserStatsDoc | undefined> => {
	const doc = await getDoc<UserStatsDoc>({
		collection: Collection.USER_STATS,
		key: principal
	});

	return doc?.data;
};
