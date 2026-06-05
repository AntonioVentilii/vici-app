/**
 * VXP economy constants — the client-side portion of the gameplay
 * currency model. These values are authoritative for the *expected*
 * payout shown in UI; the server is authoritative for the *actual*
 * credit on settlement (same pattern as any prediction market).
 *
 * Server-side award tunables (streak bonuses, calibration reward,
 * referral cap, Worlds podium) live below — the server is authoritative
 * for the actual credit; these constants drive the expected UI preview.
 *
 * See `vxp-economy.utils.ts` for the payout formula.
 */

import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import { parseToken } from '$lib/utils/parse.utils';

/**
 * Per-call stake ladder, smallest → largest. The shape is curated, not
 * arithmetic — the non-uniform jump from 300 to 500 (rather than a smooth
 * rung) is intentional.
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
 * Calibration reward (20 VXP), in **base units**. Paid once per finalised
 * Vici binary market a recovering user calls correctly. Small and fixed —
 * it is a recovery nudge that rewards reading a market right, not a payout
 * that scales with stake. Sized in base units via the canonical
 * `parseToken` helper so it matches `icrc1Transfer` / award-doc amounts
 * (same pattern as referral / onboarding awards). Tunable.
 */
export const VXP_CALIBRATION_REWARD_BASE_UNITS = parseToken({
	value: '20',
	unitName: VXP_TOKEN.decimals
});

/**
 * Recovery floor for the calibration reward (100 VXP), in **base units**.
 * The reward only pays while the caller's available balance is *below*
 * this floor — it is the core bound that keeps calibration a recovery
 * mechanic for depleted users rather than a steady income stream for
 * everyone. Compared directly against the ledger balance (also base
 * units), so it is sized via `parseToken`. Tunable.
 */
export const CALIBRATION_RECOVERY_FLOOR_BASE_UNITS = parseToken({
	value: '100',
	unitName: VXP_TOKEN.decimals
});

/**
 * Net-worth floor (150 VXP) that separates a *fully-deployed* user from a
 * *genuinely depleted* one, in **base units**. When the free wallet
 * balance hits the recovery floor, the deployed-vs-depleted split reads
 * the VXP still locked in the user's open calls (`lockedCollateral`, also
 * base units): at or above this floor the stack is "in play, nothing lost"
 * — a positive beat pointing at the open calls; below it the stack has
 * actually eroded through realised losses, so the user is offered the
 * Calibration recovery path. Sized via `parseToken` so the comparison
 * stays in base units. Tunable.
 */
export const CALIBRATION_DEPLOY_FLOOR_BASE_UNITS = parseToken({
	value: '150',
	unitName: VXP_TOKEN.decimals
});

/**
 * Maximum number of calibration rewards a single caller can earn within
 * a rolling 24-hour window. Server-enforced anti-farming bound, counted
 * off the caller's `calibration` award docs. Tunable.
 */
export const CALIBRATION_DAILY_CAP = 15;

/**
 * Maximum number of calibration rewards a single caller can earn within
 * a rolling 1-hour window. Tighter burst bound layered on top of the
 * daily cap. Server-enforced. Tunable.
 */
export const CALIBRATION_HOURLY_CAP = 6;

/**
 * Worlds podium awards for the monthly battle — 1st / 2nd / 3rd place.
 * Server-validated; surfaced in UI on the Worlds standings.
 */
export const VXP_WORLDS_PODIUM = Object.freeze({
	gold: 400,
	silver: 200,
	bronze: 100
} as const);
