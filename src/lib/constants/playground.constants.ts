import { LOCKED_CAPACITY_DISPLAY_UNIT } from '$lib/types/locked-capacity-display.types';

/** Clearing margin / equity fields use this scale for both settlement USD UI and playground VXP 1:1 display. */
export const PLAYGROUND_CLEARING_MARGIN_DECIMALS = 6;

export const PLAYGROUND_DISPLAY_SYMBOL = LOCKED_CAPACITY_DISPLAY_UNIT.Playground;

/** Label for locked margin in settlement (internal vUSD). */
export const SETTLEMENT_LOCKED_CAPACITY_LABEL = LOCKED_CAPACITY_DISPLAY_UNIT.Settlement;
