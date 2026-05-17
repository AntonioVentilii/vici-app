import { VICI_EVENTS } from '$lib/constants/events.constants';
import { emit } from '$lib/utils/events.utils';

export const refreshMarkets = () => {
	emit({ message: VICI_EVENTS.REFRESH_MARKETS });
};

export const refreshPositions = () => {
	emit({ message: VICI_EVENTS.REFRESH_POSITIONS });
};

export const refreshOrders = () => {
	emit({ message: VICI_EVENTS.REFRESH_ORDERS });
};

export const refreshAllBalances = () => {
	emit({ message: VICI_EVENTS.REFRESH_BALANCES });

	emit({ message: VICI_EVENTS.REFRESH_COLLATERALS });
};
