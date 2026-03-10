import type { ClearingDid, RegistryDid } from '$declarations';
import { listOrders as listOrdersApi } from '$lib/api/clearing.api';
import { addSeries, getSeries, listSeries } from '$lib/api/registry.api';
import {
	NANO_SECONDS_IN_MILLISECOND,
	PAYOFF_TYPE,
	PRICE_DECIMALS,
	STRIKE,
	VICI_ORACLE_V1
} from '$lib/constants/app.constants';
import { logActivity } from '$lib/services/activity.services';
import { getIdentityOrAnonymous, safeGetIdentityOnce } from '$lib/services/identity.services';
import { getOrderBook } from '$lib/services/order.services';
import { getProfile } from '$lib/services/profile.services';
import type { Market, MarketId } from '$lib/types/market';
import { ActivityType } from '$lib/types/social';
import { UserRole } from '$lib/types/user';
import { mapMarketData } from '$lib/utils/market.utils';
import { emitRefreshMarkets } from '$lib/utils/refresh.utils';
import { parseMarketId } from '$lib/validation/market.validation';
import { isNullish, nonNullish, toNullable } from '@dfinity/utils';

/**
 * Creates a new prediction market.
 * Only Admins and Creators are authorized.
 */
export const createMarket = async ({
	title,
	description,
	expiryDate,
	payoutUnit = { Fiat: { Usd: null } }
}: {
	title: string;
	description: string;
	expiryDate: bigint;
	payoutUnit?: RegistryDid.PayoutUnit;
}): Promise<string> => {
	const identity = await safeGetIdentityOnce();

	const profileDoc = await getProfile(identity.getPrincipal().toText());

	const { role } = profileDoc.data;

	if (role !== UserRole.ADMIN && role !== UserRole.CREATOR) {
		throw new Error('Unauthorized: only admins or creators can create markets');
	}

	const underlying = title
		.trim()
		.toUpperCase()
		.replace(/\s+/g, '_')
		.replace(/[^A-Z0-9_-]/g, '');

	const params: RegistryDid.AddSeriesParams = {
		underlying,
		title,
		description: {
			plain: description,
			markdown: toNullable(),
			html: toNullable()
		},
		expiry_ns: expiryDate * NANO_SECONDS_IN_MILLISECOND,
		payout_unit: payoutUnit,
		strike: STRIKE,
		price_precision: PRICE_DECIMALS,
		payoff_type: PAYOFF_TYPE,
		oracle_source: VICI_ORACLE_V1
	};

	const seriesId = await addSeries({
		identity,
		params
	});

	await logActivity({
		type: ActivityType.TRADE, // Or add a specific "MARKET_CREATED" if needed
		user: identity.getPrincipal().toText(),
		marketId: seriesId,
		title: `Market created: ${title}`,
		details: description
	});

	emitRefreshMarkets();

	return seriesId;
};

export const getMarkets = async (): Promise<Market[]> => {
	const identity = await getIdentityOrAnonymous();

	const seriesList = await listSeries({ identity });

	const markets = await Promise.all(
		seriesList.map(async (s) => {
			const mid = parseMarketId(s.series_id);

			const { yesProbability, noProbability } = await getOrderBook(mid);

			return mapMarketData({ series: s, yesProbability, noProbability });
		})
	);

	return markets.filter(nonNullish);
};

export const getMarket = async (marketId: MarketId): Promise<Market | undefined> => {
	const identity = await getIdentityOrAnonymous();

	const [s, { yesProbability, noProbability }] = await Promise.all([
		getSeries({ identity, seriesId: marketId }),
		getOrderBook(marketId)
	]);

	if (isNullish(s)) {
		return;
	}

	return mapMarketData({ series: s, yesProbability, noProbability });
};

export const getRushQueue = async (): Promise<Market[]> => {
	const identity = await getIdentityOrAnonymous();

	const [markets, allOpenOrders] = await Promise.all([
		getMarkets(),
		listOrdersApi({
			identity,
			params: { series_id: [] }
		})
	]);

	// Group orders to see which markets have both bids and asks
	const marketLiquidity = allOpenOrders.reduce<Record<string, { bids: boolean; asks: boolean }>>(
		(acc: Record<string, { bids: boolean; asks: boolean }>, order: ClearingDid.LimitOrder) => {
			const side = 'Buy' in order.side ? 'bids' : 'asks';
			if (!acc[order.series_id]) {
				acc[order.series_id] = { bids: false, asks: false };
			}
			acc[order.series_id][side] = true;
			return acc;
		},
		{}
	);

	// Filter markets to only those that have both sides of liquidity
	const rushMarkets = markets.filter(
		(market: Market) =>
			marketLiquidity[market.id] &&
			marketLiquidity[market.id].bids &&
			marketLiquidity[market.id].asks
	);

	return rushMarkets.sort((a: Market, b: Market) => Number(b.id) - Number(a.id));
};
