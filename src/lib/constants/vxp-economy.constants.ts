/**
 * VXP economy constants — the client-side portion of the gameplay
 * currency model. These values are authoritative for the *expected*
 * payout shown in UI; the server is authoritative for the *actual*
 * credit on settlement (same pattern as any prediction market).
 *
 * Server-side awards (streak bonuses, comeback grant, referral cap,
 * Worlds podium) are intentionally *not* in this file — they need their
 * own backend design proposal before any implementation lands.
 *
 * See `vxp-economy.utils.ts` for the payout formula and
 * `docs/economy.md` for the full economy spec.
 */

/**
 * Per-call stake ladder, smallest → largest. The shape is curated, not
 * arithmetic — see `docs/economy.md` §2 for the psychology behind
 * the non-uniform step from 300 to 500.
 *
 * Frozen so call sites can rely on the literal indexing without worrying
 * about runtime mutation.
 */
export const VXP_STAKE_LADDER = [50, 100, 200, 300, 500] as const;

export type VxpStake = (typeof VXP_STAKE_LADDER)[number];

/**
 * Smallest rung on the ladder. Surfaced as a named export so callers
 * don't have to reach into `VXP_STAKE_LADDER[0]` and pick up a tuple
 * literal type at every call site.
 */
export const [VXP_MIN_STAKE] = VXP_STAKE_LADDER;

/**
 * Membership-style validator for a candidate stake — the single
 * source of truth for "is this premium a valid ladder rung". Used by
 * the trade-utility premium guard and by deck-restore paths that
 * sanity-check a previously-persisted stake before re-binding it to
 * the UI. Doubles as a TS type-narrowing predicate so downstream
 * code can rely on `VxpStake` once past the guard.
 */
export const isVxpLadderStake = (n: number): n is VxpStake =>
	Number.isInteger(n) && (VXP_STAKE_LADDER as readonly number[]).includes(n);

/**
 * Default stake for new and low-activity users. Renders as the only
 * surfaced option for first-call users — no decision paralysis.
 */
export const VXP_DEFAULT_STAKE: VxpStake = 50;

/**
 * Lifetime committed-call count at which the stake ladder unlocks. Below
 * this the per-call stake stays pinned to the default rung — new
 * predictors see one stake, no decision paralysis. The slider reveals
 * once the user has enough history to make sizing a meaningful choice.
 */
export const STAKE_LADDER_UNLOCK_CALLS = 50;

/** True once the user has enough lifetime calls to choose a stake rung. */
export const isStakeLadderUnlocked = (totalCalls: number): boolean =>
	totalCalls >= STAKE_LADDER_UNLOCK_CALLS;

/**
 * Cap on the consensus probability the payout formula sees. Without a
 * floor, a 1% side would pay `100×` stake which would deplete the
 * economy. 5% caps long-shot payouts at ~20× stake.
 */
export const VXP_P_WIN_FLOOR = 0.05;

/**
 * Streak-milestone bonuses, in VXP. Granted when the user's daily streak
 * count *hits* one of the milestones. Server-validated — these constants
 * are surfaced to UI for the "next milestone" preview only.
 */
export const VXP_STREAK_BONUSES: Readonly<Record<number, number>> = Object.freeze({
	3: 50,
	7: 150,
	14: 400,
	30: 1000
});

/**
 * One-shot grant when a user's VXP balance hits zero for the first time
 * (the "comeback" mechanic). Fires once per account, server-tracked.
 */
export const VXP_COMEBACK_GRANT = 1000;

/**
 * Maximum number of referral payouts the referrer can receive within a
 * single calendar month. Server-enforced; surfaced in UI so users see
 * the cap rather than hitting a silent floor.
 */
export const VXP_REFERRAL_MONTHLY_CAP = 10;

/**
 * Worlds podium awards for the monthly battle — 1st / 2nd / 3rd place.
 * Server-validated; surfaced in UI on the Worlds standings.
 */
export const VXP_WORLDS_PODIUM = Object.freeze({
	gold: 400,
	silver: 200,
	bronze: 100
} as const);
