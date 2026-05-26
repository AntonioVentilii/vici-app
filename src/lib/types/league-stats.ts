/**
 * Per-league rolling stats. One doc per league under the
 * `LEAGUE_STATS` collection, keyed by `leagueId`.
 *
 * The doc tracks lifetime counters only — no monthly snapshots,
 * because the tournament uses arbitrary 7-day round windows (not
 * month boundaries), so a monthly anchor would be the wrong frame.
 * Instead, the tournament-resolution endpoint snapshots a league's
 * `(totalCalls, wins)` into the match doc when the league is first
 * assigned to a bracket slot, and reads the current rolling doc at
 * resolution time; the per-window accuracy is the delta between the
 * two.
 *
 * Writes are gated by `assertSetLeagueStats`: only the profile-hook
 * (signing as the user whose profile just updated) can write, and
 * only against leagues the caller is a member of. The hook's
 * recipient-binds-caller invariant matches the pattern used by
 * `AFFILIATION_STATS`.
 */
export interface LeagueStatsDoc {
	/** Parent league id — matches the doc key. */
	leagueId: string;
	/** Lifetime resolved-call count summed over all members. */
	totalCalls: number;
	/** Lifetime correct calls (the numerator for accuracy). */
	wins: number;
	/** Last hook-write timestamp (ms). */
	updatedAtMs: number;
}

/**
 * Canonical key builder. Single-segment key by leagueId — mirrors
 * the league doc's own key, so a `getDocStore` lookup against the
 * stats collection is a direct lookup, no scan.
 */
export const leagueStatsKey = ({ leagueId }: { leagueId: string }): string => leagueId;
