import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import { parseToken } from '$lib/utils/parse.utils';

/**
 * Total VXP granted per user through the new-user ladder (onboarding reserve).
 * Split 10% / 40% / 50% (1,000 + 4,000 + 5,000 = 10,000 VXP): registration, first bet, five bets.
 */
export const NEW_USER_VXP_TOTAL_BASE_UNITS = parseToken({
	value: '10000',
	unitName: VXP_TOKEN.decimals
});

const PERCENT_MILESTONE_1 = 10n;
const PERCENT_MILESTONE_2 = 40n;

/**
 * 10% — at registration (profile first create).
 */
export const newUserVxpAmountMilestone1BaseUnits = (): bigint =>
	(NEW_USER_VXP_TOTAL_BASE_UNITS * PERCENT_MILESTONE_1) / 100n;

/**
 * 40% — after the first bet.
 */
export const newUserVxpAmountMilestone2BaseUnits = (): bigint =>
	(NEW_USER_VXP_TOTAL_BASE_UNITS * PERCENT_MILESTONE_2) / 100n;

/**
 * 50% — after five bets (remainder so the three payouts sum exactly to total).
 */
export const newUserVxpAmountMilestone3BaseUnits = (): bigint =>
	NEW_USER_VXP_TOTAL_BASE_UNITS -
	newUserVxpAmountMilestone1BaseUnits() -
	newUserVxpAmountMilestone2BaseUnits();
