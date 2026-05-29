/**
 * Whole-VXP stake step for ViciXp (playground) orders. Aligned with the
 * smallest gap in `VXP_STAKE_LADDER` (`50 → 100`) so the first rung of
 * the ladder — and the default stake `VXP_DEFAULT_STAKE = 50` — passes
 * the `premium % VXP_STAKE_STEP_VXP === 0` check in
 * `assertViciXpHumanPremiumAndPayout`. Bumping this to 100 (an earlier
 * attempt at a "minimum sensible bet") rejected every 50-VXP call placed
 * from the Flow surface.
 */
export const VXP_STAKE_STEP_VXP = 50;

/**
 * Minimum potential payout if the prediction wins, in whole VXP.
 */
export const VXP_MIN_MAX_PAYOUT_VXP = 100;
