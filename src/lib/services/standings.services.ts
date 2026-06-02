import type { ClearingDid } from '$declarations';
import { listLeaderboard } from '$lib/api/clearing.api';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { loadProfilesByPrincipals } from '$lib/services/profile.services';
import { setGlobalStandings } from '$lib/stores/standings.store';
import type { StandingEntry, StandingsResult, StandingsWindow } from '$lib/types/standings';
import { fromNullable } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import type { PrincipalText } from '@junobuild/schema';

/**
 * Per-window ranked standings, sourced from the clearing canister's
 * `list_leaderboard` query (ranked by net realized P&L over a fixed calendar
 * window). The query is `caller_is_not_anonymous`-guarded, so every read
 * needs a signed-in identity.
 *
 * The clearing layer owns settlement and ranking; the satellite owns league
 * membership, so the league filter is supplied by the caller as a principal
 * set (`members`). This service maps the wire aggregate onto the FE
 * {@link StandingEntry} view model (rank, prior-window rank, the ↑/↓ delta,
 * realized P&L, and a `win_count / settled_count` accuracy) — it never
 * fabricates a figure: an empty window simply yields no entries.
 */

/** Drain cap: one window's ranked list is bounded so a large global standings
 *  set can't fan out into an unbounded number of round-trips. At 500 entries
 *  per page this covers 5,000 ranked principals. */
const MAX_STANDINGS_PAGES = 10;
const STANDINGS_PAGE_LIMIT = 500n;

const toWindow = (window: StandingsWindow): ClearingDid.LeaderboardWindow => {
	switch (window) {
		case 'week':
			return { Week: null };
		case 'month':
			return { Month: null };
		case 'all':
			return { AllTime: null };
	}
};

const toEntry = (entry: ClearingDid.LeaderboardEntry): StandingEntry => {
	const rank = Number(entry.rank);
	const priorRankRaw = fromNullable(entry.prior_rank);
	const priorRank = priorRankRaw === undefined ? undefined : Number(priorRankRaw);

	// `priorRank - rank` so a smaller (better) current rank reads as a
	// positive climb; `undefined` when there is no comparable prior window.
	const rankDelta = priorRank === undefined ? undefined : priorRank - rank;

	const settledCount = Number(entry.settled_count);
	const winCount = Number(entry.win_count);
	const accuracy = settledCount === 0 ? 0 : Math.round((winCount / settledCount) * 100);

	return {
		owner: entry.principal.toText(),
		rank,
		priorRank,
		rankDelta,
		realizedPnl: entry.realized_pnl,
		settledCount,
		winCount,
		accuracy
	};
};

/**
 * Global ranked standings for one window. Only principals that settled at
 * least one position in the window appear; an empty / cold-start window
 * yields no entries.
 */
export const getStandings = async ({
	window
}: {
	window: StandingsWindow;
}): Promise<StandingsResult> => {
	const identity = await safeGetIdentityOnce();

	const { items, total } = await listLeaderboard({
		identity,
		window: toWindow(window),
		pageLimit: STANDINGS_PAGE_LIMIT,
		maxPages: MAX_STANDINGS_PAGES,
		certified: false
	});

	return { window, entries: items.map(toEntry), total: Number(total) };
};

/**
 * Loads one window's global standings, hydrates the shared profile cache for
 * every ranked principal (so rows can render handle / avatar), and merges the
 * slice into {@link globalStandingsStore}. Awaited by the Leaderboard tab and
 * the dashboard rank tiles; profile hydration is best-effort and never blocks
 * the standings from landing.
 */
export const loadGlobalStandings = async ({
	window
}: {
	window: StandingsWindow;
}): Promise<void> => {
	const result = await getStandings({ window });

	setGlobalStandings(result);

	if (result.entries.length > 0) {
		await loadProfilesByPrincipals({
			principals: result.entries.map((entry) => entry.owner)
		}).catch(() => undefined);
	}
};

/**
 * Ranked standings within a single league / affiliation, computed over the
 * supplied member set in isolation (inactive members are included with a
 * zeroed aggregate, so the slice covers the whole roster). Returns an empty
 * result when the roster is empty.
 */
export const getLeagueStandings = async ({
	window,
	members
}: {
	window: StandingsWindow;
	members: PrincipalText[];
}): Promise<StandingsResult> => {
	if (members.length === 0) {
		return { window, entries: [], total: 0 };
	}

	const identity = await safeGetIdentityOnce();

	const { items, total } = await listLeaderboard({
		identity,
		window: toWindow(window),
		members: members.map((m) => Principal.fromText(m)),
		pageLimit: STANDINGS_PAGE_LIMIT,
		maxPages: MAX_STANDINGS_PAGES,
		certified: false
	});

	return { window, entries: items.map(toEntry), total: Number(total) };
};

/**
 * The signed-in viewer's own standing within a window, or `undefined` when
 * they have not yet appeared (no settled position in the window). Convenience
 * over {@link getStandings} for the dashboard rank tiles.
 */
export const findOwnStanding = ({
	result,
	owner
}: {
	result: StandingsResult;
	owner: PrincipalText | undefined;
}): StandingEntry | undefined => {
	if (owner === undefined) {
		return;
	}

	return result.entries.find((entry) => entry.owner === owner);
};
