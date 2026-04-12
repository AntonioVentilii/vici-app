/**
 * UI label for locked-collateral denomination: VXP (playground) vs internal vUSD (settlement).
 */
export const LOCKED_CAPACITY_DISPLAY_UNIT = {
	Playground: 'VXP',
	Settlement: 'vUSD'
} as const;

export type LockedCapacityDisplayUnit =
	(typeof LOCKED_CAPACITY_DISPLAY_UNIT)[keyof typeof LOCKED_CAPACITY_DISPLAY_UNIT];
