import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import { parseToken } from '$lib/utils/parse.utils';

/**
 * Total VXP granted per user through the new-user ladder (onboarding reserve).
 * Explicit amounts (500 + 500 + 500 = 1,500 VXP): registration, first call, five calls.
 */
export const NEW_USER_VXP_TOTAL_BASE_UNITS = parseToken({
	value: '1500',
	unitName: VXP_TOKEN.decimals
});

const MILESTONE_1_VXP = parseToken({ value: '500', unitName: VXP_TOKEN.decimals });
const MILESTONE_2_VXP = parseToken({ value: '500', unitName: VXP_TOKEN.decimals });

export const newUserVxpAmountMilestone1BaseUnits = (): bigint => MILESTONE_1_VXP;

export const newUserVxpAmountMilestone2BaseUnits = (): bigint => MILESTONE_2_VXP;

// Computed as the remainder so the three milestones sum exactly to `NEW_USER_VXP_TOTAL_BASE_UNITS`.
export const newUserVxpAmountMilestone3BaseUnits = (): bigint =>
	NEW_USER_VXP_TOTAL_BASE_UNITS -
	newUserVxpAmountMilestone1BaseUnits() -
	newUserVxpAmountMilestone2BaseUnits();
