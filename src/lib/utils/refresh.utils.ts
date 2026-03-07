import { emit } from '$lib/utils/events.utils';

/**
 * Custom event names for triggering UI refreshes.
 */
export const REFRESH_MARKETS = 'vici:refresh-markets';
export const REFRESH_POSITIONS = 'vici:refresh-positions';

/**
 * Dispatches a custom event to notify components to re-fetch market data.
 */
export const emitRefreshMarkets = () => {
	window.dispatchEvent(new CustomEvent(REFRESH_MARKETS));
};

/**
 * Dispatches a custom event to notify components to re-fetch position data.
 */
export const emitRefreshPositions = () => {
	window.dispatchEvent(new CustomEvent(REFRESH_POSITIONS));
};

export const refreshAllBalances = () => {
	emit({ message: 'viciRefreshBalances' });

	emit({ message: 'viciRefreshCollaterals' });
};
