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

import { MARKET_TAGS, type MarketTag } from '$lib/constants/market-tags.constants';

export type BattleKind = 'league' | 'duel';

export type BattleState = 'proposed' | 'accepted' | 'in_flight' | 'resolved';

export type BattleWinner = 'A' | 'B' | 'draw';

/**
 * Which calls count toward a battle's scoreline. `'all'` counts every
 * settled call regardless of category; any {@link MarketTag} narrows the
 * battle to a single market category (e.g. `'wc'`, `'macro'`). Picked
 * once at proposal time and frozen alongside the other identity fields.
 */
export type BattleScope = 'all' | MarketTag;

/** Allowed scope values: `'all'` plus every market category tag. */
export const BATTLE_SCOPES: ReadonlySet<BattleScope> = new Set<BattleScope>([
	'all',
	...MARKET_TAGS
]);

/** Default scope when the proposer doesn't narrow the category. */
export const BATTLE_SCOPE_DEFAULT: BattleScope = 'all';

export const isBattleScope = (value: string): value is BattleScope =>
	(BATTLE_SCOPES as ReadonlySet<string>).has(value);

/** Inclusive wager bounds, in VXP. A wager of `0` means "no stake". */
export const BATTLE_WAGER_MIN = 0;
export const BATTLE_WAGER_MAX = 500;
export const BATTLE_WAGER_DEFAULT = BATTLE_WAGER_MIN;

/** Trash-talk message length cap — brevity is rewarded. */
export const BATTLE_TRASH_TALK_MAX_LENGTH = 60;

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
	/**
	 * Which market category the battle counts. `'all'` (the default)
	 * counts every settled call; a {@link MarketTag} narrows to one
	 * category. Chosen at proposal time and immutable thereafter.
	 * Absent on legacy rows written before the picker shipped — callers
	 * fall back to {@link BATTLE_SCOPE_DEFAULT}.
	 */
	scope?: BattleScope;
	/**
	 * Optional VXP stake on the battle outcome, in
	 * [{@link BATTLE_WAGER_MIN}, {@link BATTLE_WAGER_MAX}]. `0` (the
	 * default) means no stake. Chosen at proposal time and immutable
	 * thereafter. Absent on legacy rows — callers fall back to
	 * {@link BATTLE_WAGER_DEFAULT}.
	 */
	wager?: number;
	/**
	 * Optional short trash-talk message the proposer attaches, capped at
	 * {@link BATTLE_TRASH_TALK_MAX_LENGTH} chars. Chosen at proposal time
	 * and immutable thereafter.
	 */
	trashTalk?: string;
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
