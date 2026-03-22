import { emit } from '$lib/utils/events.utils';

/** Dispatches custom DOM events so listeners refresh markets, orders, positions, or balances. */
export const refreshMarkets = () => {
	emit({ message: 'viciRefreshMarkets' });
};

/** Requests a positions data refresh across the app. */
export const refreshPositions = () => {
	emit({ message: 'viciRefreshPositions' });
};

/** Requests an open-orders refresh. */
export const refreshOrders = () => {
	emit({ message: 'viciRefreshOrders' });
};

/** Requests wallet and collateral balance refreshes. */
export const refreshAllBalances = () => {
	emit({ message: 'viciRefreshBalances' });

	emit({ message: 'viciRefreshCollaterals' });
};
