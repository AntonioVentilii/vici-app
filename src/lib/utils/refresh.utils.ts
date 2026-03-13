import { emit } from '$lib/utils/events.utils';

export const refreshMarkets = () => {
	emit({ message: 'viciRefreshMarkets' });
};

export const refreshPositions = () => {
	emit({ message: 'viciRefreshPositions' });
};

export const refreshOrders = () => {
	emit({ message: 'viciRefreshOrders' });
};

export const refreshAllBalances = () => {
	emit({ message: 'viciRefreshBalances' });

	emit({ message: 'viciRefreshCollaterals' });
};
