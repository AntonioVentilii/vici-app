import { VICI_EVENTS } from '$lib/constants/events.constants';
import { emit } from '$lib/utils/events.utils';

/** Dispatches custom DOM events so listeners refresh markets, orders, positions, or balances. */
export const refreshMarkets = () => {
	emit({ message: VICI_EVENTS.REFRESH_MARKETS });
};

/** Requests a positions data refresh across the app. */
export const refreshPositions = () => {
	emit({ message: VICI_EVENTS.REFRESH_POSITIONS });
};

/** Requests an open-orders refresh. */
export const refreshOrders = () => {
	emit({ message: VICI_EVENTS.REFRESH_ORDERS });
};

/** Requests wallet and collateral balance refreshes. */
export const refreshAllBalances = () => {
	emit({ message: VICI_EVENTS.REFRESH_BALANCES });

	emit({ message: VICI_EVENTS.REFRESH_COLLATERALS });
};
