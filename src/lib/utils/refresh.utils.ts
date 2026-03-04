/**
 * Custom event names for triggering UI refreshes.
 */
export const REFRESH_MARKETS = 'vici:refresh-markets';
export const REFRESH_POSITIONS = 'vici:refresh-positions';
export const REFRESH_BALANCE = 'vici:refresh-balance';

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

/**
 * Dispatches a custom event to notify components to re-fetch balance/margin account data.
 */
export const emitRefreshBalance = () => {
	window.dispatchEvent(new CustomEvent(REFRESH_BALANCE));
};
