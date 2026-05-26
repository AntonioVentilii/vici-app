import { functions } from '$declarations/satellite/satellite.api';
import {
	monthAnchorFromMs,
	type TournamentDoc,
	type TournamentMatchDoc,
	type TournamentRound
} from '$lib/types/tournament';

/**
 * Monthly tournament — Proposal 3 FE wrappers.
 *
 * Pattern is the same as the Worlds podium: the satellite has no
 * scheduler, so the draw is fire-and-forget on every Tournament-
 * page mount (idempotent via doc-key collision on the month anchor).
 * `getCurrentTournament` then drives the bracket render.
 */

/**
 * Project the satellite's snake_case wire schema for a tournament
 * to FE camelCase.
 */
const projectTournamentWire = (wire: {
	id: string;
	month_start_ms: number;
	month_end_ms: number;
	bracket_size: number;
	state: 'in_flight' | 'concluded';
	seeded_league_ids: string[];
	created_at_ms: number;
}): TournamentDoc => ({
	id: wire.id,
	monthStartMs: wire.month_start_ms,
	monthEndMs: wire.month_end_ms,
	bracketSize: wire.bracket_size,
	state: wire.state,
	seededLeagueIds: wire.seeded_league_ids,
	createdAtMs: wire.created_at_ms
});

/**
 * Project the satellite's snake_case wire schema for a match to FE
 * camelCase. Optional snake_case fields land as `undefined`; we
 * normalise to `null` so the FE can pattern-match on `=== null` to
 * detect "TBD" slots.
 */
const projectMatchWire = (wire: {
	tournament_id: string;
	round: TournamentRound;
	index: number;
	from_league_id?: string;
	to_league_id?: string;
	from_acc?: number;
	to_acc?: number;
	winner_league_id?: string;
	start_ms: number;
	end_ms: number;
}): TournamentMatchDoc => ({
	tournamentId: wire.tournament_id,
	round: wire.round,
	index: wire.index,
	fromLeagueId: wire.from_league_id ?? null,
	toLeagueId: wire.to_league_id ?? null,
	fromAcc: wire.from_acc ?? null,
	toAcc: wire.to_acc ?? null,
	winnerLeagueId: wire.winner_league_id ?? null,
	startMs: wire.start_ms,
	endMs: wire.end_ms
});

/**
 * Read the current tournament + its matches. Returns `null` for
 * the tournament when none has been drawn yet — the FE should
 * render a "draw a bracket" state.
 */
export const getCurrentTournament = async (): Promise<{
	tournament: TournamentDoc | null;
	matches: TournamentMatchDoc[];
}> => {
	const { tournament, matches } = await functions.getCurrentTournament();

	return {
		tournament: tournament === undefined ? null : projectTournamentWire(tournament),
		matches: matches.map(projectMatchWire)
	};
};

export interface TriggerTournamentDrawResult {
	ok: boolean;
	tournamentId?: string;
	reason?: 'already_drawn' | 'month_not_started' | 'insufficient_leagues' | 'invalid_input';
	availableLeagues?: number;
}

/**
 * Fire the draw for `monthAnchor`. Idempotent — a second call for
 * the same month returns `already_drawn` cleanly. Safe to
 * fire-and-forget on every Tournament-page mount.
 */
export const triggerTournamentDraw = ({
	monthAnchor
}: {
	monthAnchor: string;
}): Promise<TriggerTournamentDrawResult> => functions.triggerTournamentDraw({ monthAnchor });

/**
 * Convenience: the current calendar month's anchor (UTC). Used by
 * the FE to default the draw trigger to the in-progress month.
 */
export const currentMonthAnchor = (nowMs: number = Date.now()): string => monthAnchorFromMs(nowMs);
