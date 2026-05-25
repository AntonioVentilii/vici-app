/**
 * VXP economy constants — the client-side portion of the prototype gameplay
 * currency model. These values are authoritative for the *expected*
 * payout shown in UI; the server is authoritative for the *actual*
 * credit on settlement (same pattern as any prediction market).
 *
 * Server-side awards (streak bonuses, comeback grant, referral cap,
 * Worlds podium) are intentionally *not* in this file — they need their
 * own backend design proposal before any implementation lands.
 *
 * See `vxp-economy.utils.ts` for the payout formula and
 * `docs/economy.md` in the design prototype for the full economy spec.
 */

/**
 * Per-call stake ladder, smallest → largest. The shape is curated, not
 * arithmetic — see prototype `docs/economy.md` §2 for the psychology behind
 * the non-uniform step from 300 to 500.
 *
 * Frozen so call sites can rely on the literal indexing without worrying
 * about runtime mutation.
 */
export const VXP_STAKE_LADDER = [50, 100, 200, 300, 500] as const;

export type VxpStake = (typeof VXP_STAKE_LADDER)[number];

/**
 * Default stake for new and low-activity users. Renders as the only
 * surfaced option until the user crosses `VXP_STAKE_UNLOCK_AT_CALLS` —
 * no decision paralysis on first-call.
 */
export const VXP_DEFAULT_STAKE: VxpStake = 50;

/**
 * Cap on the consensus probability the payout formula sees. Without a
 * floor, a 1% side would pay `100×` stake which would deplete the
 * economy. 5% caps long-shot payouts at ~20× stake.
 */
export const VXP_P_WIN_FLOOR = 0.05;

/**
 * Number of completed calls before the stake slider is exposed to the
 * user. Below this threshold, `VXP_DEFAULT_STAKE` is the only option.
 */
export const VXP_STAKE_UNLOCK_AT_CALLS = 50;

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
 * Per-signup VXP credited to the referrer when a referee completes
 * onboarding. Capped at `VXP_REFERRAL_MONTHLY_CAP` referrals per
 * calendar month.
 */
export const VXP_REFERRAL_REWARD = 500;

/**
 * Maximum number of referral payouts the referrer can receive within a
 * single calendar month. Server-enforced; surfaced in UI so users see
 * the cap rather than hitting a silent floor.
 */
export const VXP_REFERRAL_MONTHLY_CAP = 10;

/**
 * Worlds podium awards for the monthly bout — 1st / 2nd / 3rd place.
 * Server-validated; surfaced in UI on the Worlds standings.
 */
export const VXP_WORLDS_PODIUM = Object.freeze({
	gold: 400,
	silver: 200,
	bronze: 100
} as const);
