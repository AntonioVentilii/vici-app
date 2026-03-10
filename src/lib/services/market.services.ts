import type { RegistryDid } from '$declarations';
import { addSeries, getSeries, listSeries } from '$lib/api/registry.api';
import {
	NANO_SECONDS_IN_MILLISECOND,
	PAYOFF_TYPE,
	PRICE_DECIMALS,
	STRIKE,
	VICI_ORACLE_V1
} from '$lib/constants/app.constants';
import { getGlobalActivities, logActivity } from '$lib/services/activity.services';
import { getIdentityOrAnonymous, safeGetIdentityOnce } from '$lib/services/identity.services';
import { getOrderBook } from '$lib/services/order.services';
import { getProfile } from '$lib/services/profile.services';
import type { Market, MarketId, MarketStatus, Outcome } from '$lib/types/market';
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

	const [seriesList, activities] = await Promise.all([
		listSeries({ identity }),
		getGlobalActivities()
	]);

	const resolutionMap = activities
		.filter((a) => a.type === ActivityType.SETTLEMENT && nonNullish(a.marketId))
		.reduce<Record<string, { outcome: Outcome }>>((acc, a) => {
			const { marketId, details } = a;
			try {
				const { outcome } = JSON.parse(details ?? '{}');
				if (nonNullish(marketId)) {
					acc[marketId] = { outcome };
				}
			} catch (e) {
				console.error('Failed to parse settlement details', e);
			}
			return acc;
		}, {});

	const markets = await Promise.all(
		seriesList.map(async (s) => {
			const mid = parseMarketId(s.series_id);
			const { yesProbability, noProbability, bids, asks } = await getOrderBook(mid);
			const bestBid = bids[0]?.price;
			const bestAsk = asks[0]?.price;

			const isExpired = s.expiry_ns / NANO_SECONDS_IN_MILLISECOND <= BigInt(Date.now());

			return mapMarketData({
				series: s,
				yesProbability,
				noProbability,
				bestBid,
				bestAsk,
				status: isExpired ? 'Expired' : 'Open'
			});
		})
	);

	// Add resolved markets that are no longer in the registry
	const resolvedSeriesIds = Object.keys(resolutionMap);
	const activeSeriesIds = new Set(seriesList.map((s) => s.series_id));

	const resolvedMarkets = await Promise.all(
		resolvedSeriesIds
			.filter((id) => !activeSeriesIds.has(id))
			.map(async (id) => {
				const series = await getSeries({ identity, seriesId: id });
				if (isNullish(series)) {
					return undefined;
				}

				return mapMarketData({
					series,
					status: 'Resolved',
					outcome: resolutionMap[id].outcome
				});
			})
	);

	return [...markets, ...resolvedMarkets].filter(nonNullish);
};

export const getMarket = async (marketId: MarketId): Promise<Market | undefined> => {
	const identity = await getIdentityOrAnonymous();

	const [s, { yesProbability, noProbability, bids, asks }, activities] = await Promise.all([
		getSeries({ identity, seriesId: marketId }),
		getOrderBook(marketId),
		getGlobalActivities()
	]);

	const bestBid = bids[0]?.price;
	const bestAsk = asks[0]?.price;

	if (isNullish(s)) {
		return;
	}

	const resolution = activities.find(
		(a) => a.type === ActivityType.SETTLEMENT && a.marketId === marketId
	);

	let status: MarketStatus = 'Open';
	let outcome: Outcome | undefined;

	if (nonNullish(resolution)) {
		status = 'Resolved';
		try {
			const { outcome: settlementOutcome } = JSON.parse(resolution.details ?? '{}');
			outcome = settlementOutcome;
		} catch (e) {
			console.error('Failed to parse outcome from activity', e);
		}
	} else if (s.expiry_ns / NANO_SECONDS_IN_MILLISECOND <= BigInt(Date.now())) {
		status = 'Expired';
	}

	return mapMarketData({
		series: s,
		yesProbability,
		noProbability,
		bestBid,
		bestAsk,
		status,
		outcome
	});
};

export const getRushQueue = async (): Promise<Market[]> => {
	const markets = await getMarkets();

	return markets.filter((m) => m.status === 'Open').sort((a, b) => Number(b.id) - Number(a.id));
};
