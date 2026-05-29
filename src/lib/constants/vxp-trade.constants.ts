/**
 * Minimum potential payout if the prediction wins, in whole VXP.
 *
 * Note: the stake-divisibility check that used to live next to this
 * constant (`VXP_STAKE_STEP_VXP`) has been folded into
 * `isVxpLadderStake` in `vxp-economy.constants.ts` — the trade guard
 * now validates membership in `VXP_STAKE_LADDER` directly rather than
 * a modulo step. UI inputs that need a literal "smallest rung" use
 * `VXP_MIN_STAKE` from the same module.
 */
export const VXP_MIN_MAX_PAYOUT_VXP = 100;
