import { VXP_STAKE_LADDER } from '$lib/constants/vxp-economy.constants';

/**
 * Whole-VXP stake step for ViciXp (playground) orders. Derived from
 * `VXP_STAKE_LADDER[0]` so the step is always the smallest rung on the
 * curated ladder — no second source of truth that can drift when the
 * ladder is reshuffled. Used as the `min` + `step` for the manual stake
 * input and as the divisibility check inside
 * `assertViciXpHumanPremiumAndPayout`.
 */
export const [VXP_STAKE_STEP_VXP] = VXP_STAKE_LADDER;

/**
 * Minimum potential payout if the prediction wins, in whole VXP.
 */
export const VXP_MIN_MAX_PAYOUT_VXP = 100;
