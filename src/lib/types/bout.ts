/**
 * Social cohorts — bouts.
 *
 * A bout is a time-bound competition between two parties:
 *
 *   - `league` — leagueA vs leagueB. Either league's owner can
 *     propose; the other league's owner accepts. Settling happens
 *     when both leagues' members have logged calls during the
 *     bout window and the satellite computes accuracy averages.
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

export type BoutKind = 'league' | 'duel';

export type BoutState = 'proposed' | 'accepted' | 'in_flight' | 'resolved';

export type BoutWinner = 'A' | 'B' | 'draw';

export interface BoutDoc {
	/** Stable bout id — matches the doc key. */
	id: string;
	/** League-vs-league or principal-vs-principal? */
	kind: BoutKind;
	/** Side A: league id (for kind='league') OR proposer principal text (for kind='duel'). */
	sideA: string;
	/** Side B: league id (for kind='league') OR challenger principal text (for kind='duel'). */
	sideB: string;
	/** Who proposed the bout. Always a principal text. For 'league' bouts this is the league.owner
	 *  at proposal time; for 'duel' bouts this is sideA. */
	proposer: string;
	/** Current state. */
	state: BoutState;
	/** When the competition window opens (ms since epoch). Immutable after `accepted`. */
	kickoffMs: number;
	/** When the competition window closes (ms since epoch). Immutable after `accepted`. */
	settleMs: number;
	/** Side A score at settle. Write-once when state moves to `resolved`. */
	scoreA?: number;
	/** Side B score at settle. Write-once when state moves to `resolved`. */
	scoreB?: number;
	/** Derived from scores at settle. Write-once. */
	winner?: BoutWinner;
}

export const BOUT_STATES: ReadonlySet<BoutState> = new Set<BoutState>([
	'proposed',
	'accepted',
	'in_flight',
	'resolved'
]);

export const BOUT_KINDS: ReadonlySet<BoutKind> = new Set<BoutKind>(['league', 'duel']);

/**
 * Forward-only transition map. `current → allowed-next`. Terminal
 * states (`resolved`) have no entry.
 */
export const BOUT_TRANSITIONS: Readonly<Record<BoutState, ReadonlySet<BoutState>>> = {
	proposed: new Set<BoutState>(['accepted']),
	accepted: new Set<BoutState>(['in_flight']),
	in_flight: new Set<BoutState>(['resolved']),
	resolved: new Set<BoutState>()
};
