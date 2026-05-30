/**
 * Social cohorts — battles.
 *
 * A battle is a time-bound competition between two parties:
 *
 *   - `league` — leagueA vs leagueB. Either league's owner can
 *     propose; the other league's owner accepts. Settling happens
 *     when both leagues' members have logged calls during the
 *     battle window and the satellite computes accuracy averages.
 *
 *   - `duel` — proposer principal vs challenger principal. Same
 *     state machine, simpler auth (both principals are explicit
 *     on the doc).
 *
 * State machine (forward-only):
 *
 *   proposed → accepted → in_flight → resolved
 *
 * Each transition is gated by the satellite assert on caller +
 * current state. Scores write once at the `resolved` transition;
 * winner is derived from scores.
 */

export type BattleKind = 'league' | 'duel';

export type BattleState = 'proposed' | 'accepted' | 'in_flight' | 'resolved';

export type BattleWinner = 'A' | 'B' | 'draw';

export interface BattleDoc {
	/** Stable battle id — matches the doc key. */
	id: string;
	/** League-vs-league or principal-vs-principal? */
	kind: BattleKind;
	/** Side A: league id (for kind='league') OR proposer principal text (for kind='duel'). */
	sideA: string;
	/** Side B: league id (for kind='league') OR challenger principal text (for kind='duel'). */
	sideB: string;
	/** Who proposed the battle. Always a principal text. For 'league' battles this is the league.owner
	 *  at proposal time; for 'duel' battles this is sideA. */
	proposer: string;
	/** Current state. */
	state: BattleState;
	/** When the competition window opens (ms since epoch). Immutable after `accepted`. */
	kickoffMs: number;
	/** When the competition window closes (ms since epoch). Immutable after `accepted`. */
	settleMs: number;
	/** Side A score at settle. Write-once when state moves to `resolved`. */
	scoreA?: number;
	/** Side B score at settle. Write-once when state moves to `resolved`. */
	scoreB?: number;
	/** Derived from scores at settle. Write-once. */
	winner?: BattleWinner;
}

export const BATTLE_STATES: ReadonlySet<BattleState> = new Set<BattleState>([
	'proposed',
	'accepted',
	'in_flight',
	'resolved'
]);

export const BATTLE_KINDS: ReadonlySet<BattleKind> = new Set<BattleKind>(['league', 'duel']);

/**
 * Forward-only transition map. `current → allowed-next`. Terminal
 * states (`resolved`) have no entry.
 */
export const BATTLE_TRANSITIONS: Readonly<Record<BattleState, ReadonlySet<BattleState>>> = {
	proposed: new Set<BattleState>(['accepted']),
	accepted: new Set<BattleState>(['in_flight']),
	in_flight: new Set<BattleState>(['resolved']),
	resolved: new Set<BattleState>()
};
