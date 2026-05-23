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

export const refreshTradeHistory = () => {
	emit({ message: VICI_EVENTS.REFRESH_TRADE_HISTORY });
};

export const refreshGlobalActivities = () => {
	emit({ message: VICI_EVENTS.REFRESH_GLOBAL_ACTIVITIES });
};

/**
 * Tell the comment cache to drop the cached entry for `marketId` so the
 * next render fetches fresh comments. The detail (the market id) is read
 * by `LoaderMarketComments` to know which entry to invalidate.
 */
export const refreshMarketComments = (marketId: string) => {
	emit({ message: VICI_EVENTS.REFRESH_MARKET_COMMENTS, detail: marketId });
};

export const refreshAllBalances = () => {
	emit({ message: VICI_EVENTS.REFRESH_BALANCES });

	emit({ message: VICI_EVENTS.REFRESH_COLLATERALS });
};

/**
 * Re-projects every `MarketMetadata` doc into the cached `seriesId →
 * MarketTag[]` map. Fire this after editing a market's tags so the
 * detail header, FlowCard artwork, Markets feed ranking, and any other
 * surface reading from `marketTagsStore` picks up the change without a
 * full page reload.
 */
export const refreshMarketTags = () => {
	emit({ message: VICI_EVENTS.REFRESH_MARKET_TAGS });
};
