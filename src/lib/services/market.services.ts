import type { RegistryDid } from '$declarations';
import { listOrders as listOrdersApi } from '$lib/api/clearing.api';
import { addSeries, forkSeries, getSeries, listSeries } from '$lib/api/registry.api';
import {
	MILLISECOND_IN_NANOSECONDS,
	PAYOFF_TYPE,
	PRICE_DECIMALS,
	STRIKE,
	VICI_ORACLE_V1,
	ZERO
} from '$lib/constants/app.constants';
import { VICI_ENGINE_ID } from '$lib/constants/icdc.constants';
import { ActivityType } from '$lib/enums/social';
import { UserRole } from '$lib/enums/user';
import { getGlobalActivities, logActivity } from '$lib/services/activity.services';
import { listSeriesCategories } from '$lib/services/category.services';
import { getIdentityOrAnonymous, safeGetIdentityOnce } from '$lib/services/identity.services';
import { getOrderBook } from '$lib/services/order.services';
import { getProfile } from '$lib/services/profile.services';
import { loadWithCertification } from '$lib/services/query-update.services';
import type { SeriesCategory } from '$lib/types/category';
import type { Market, MarketId, MarketStatus, Outcome } from '$lib/types/market';
import type { Activity } from '$lib/types/social';
import { filterByPlaygroundExpandedDomain } from '$lib/utils/balance-domain.utils';
import { decimalFixedValueToNumber } from '$lib/utils/format.utils';
import {
	calculateCategoricalProbabilities,
	calculateMarketStats,
	mapMarketData
} from '$lib/utils/market.utils';
import { refreshMarkets } from '$lib/utils/refresh.utils';
import { parseMarketId } from '$lib/validation/market.validation';
import { isNullish, nonNullish, toNullable } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';

/**
 * Creates a new prediction market.
 * Only Admins and Creators are authorized.
 */
export const createMarket = async ({
	title,
	description,
	expiryDate,
	outcomes = [],
	payoutUnit: payoutUnitOverride,
	socialReward,
	balanceDomain,
	tradingAccess = [{ Open: null }]
}: {
	title: string;
	description: string;
	expiryDate: bigint;
	outcomes?: string[];
	payoutUnit?: RegistryDid.PayoutUnit;
	socialReward?: { title: string; description?: string; iconUrl?: string };
	balanceDomain: RegistryDid.BalanceDomain;
	tradingAccess?: RegistryDid.TradingAccess[];
}): Promise<string> => {
	const identity = await safeGetIdentityOnce();

	const domain = balanceDomain;
	const payoutUnit: RegistryDid.PayoutUnit = nonNullish(socialReward)
		? {
				NonMonetary: {
					Social: {
						title: socialReward.title,
						description: toNullable(socialReward.description),
						icon_url: toNullable(socialReward.iconUrl)
					}
				}
			}
		: (payoutUnitOverride ?? { Fiat: { Usd: null } });

	const profileDoc = await getProfile(identity.getPrincipal().toText());

	const { role } = profileDoc.data;
	const isSocialMarket = 'Social' in domain;
	const isEngineCreator = role === UserRole.ADMIN || role === UserRole.CREATOR;

	if (!isEngineCreator && !isSocialMarket) {
		throw new Error(
			'Unauthorized: only admins or creators can create financial markets. ' +
				'Regular users may only create social (bragging-stakes) challenges.'
		);
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
		expiry_ns: expiryDate * MILLISECOND_IN_NANOSECONDS,
		payout_unit: payoutUnit,
		strike: STRIKE,
		icon_url: toNullable(),
		banner_url: toNullable(),
		price_precision: PRICE_DECIMALS,
		payoff_type: outcomes.length > 0 ? { Categorical: null } : PAYOFF_TYPE,
		outcomes: toNullable(
			outcomes.length > 0
				? outcomes.map((o) => ({
						id: o.trim().toLowerCase().replace(/\s+/g, '-'),
						title: o,
						description: toNullable(),
						icon_url: toNullable()
					}))
				: undefined
		),
		balance_domain: domain,
		oracle_source: VICI_ORACLE_V1,
		trading_access: tradingAccess,
		// Engine tier vs. Social tier on the registry is selected by the presence of
		// `engine_id`. Engine Creators (ADMIN/CREATOR) go through `CreationTier::Creator`
		// on `eng_0`. Regular users creating a Social market must send `None` so the
		// call routes to `CreationTier::Social` instead of being rejected with
		// `EngineRoleNotHeld`.
		engine_id: isEngineCreator ? toNullable(VICI_ENGINE_ID) : toNullable()
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

	refreshMarkets();

	return seriesId;
};

/**
 * Core market-loading logic: series + enrichment + resolution merge.
 *
 * Accepts an explicit `identity` and `certified` flag so the caller can run this
 * once as an uncertified query (fast) and/or once as a certified update (verified).
 * This is what makes the function compatible with {@link loadMarkets} / `queryAndUpdate`.
 *
 * Note: Juno-backed calls (`getGlobalActivities`) honor the same flag but tap the
 * satellite datastore, not an ICDC canister.
 */
const fetchMarkets = async ({
	identity,
	certified,
	domain
}: {
	identity: Identity;
	certified: boolean;
	domain: RegistryDid.BalanceDomain;
}): Promise<Market[]> => {
	const [seriesList, activities] = await Promise.all([
		listSeries({ identity, certified }),
		getGlobalActivities({ certified })
	]);

	const resolutionMap = buildResolutionMap(activities);

	const markets = await Promise.all(
		seriesList.map(async (s) => {
			const mid = parseMarketId(s.series_id);
			const isCategorical = 'Categorical' in s.payoff_type;
			const resolution = resolutionMap[s.series_id];
			const isResolved = nonNullish(resolution);
			const isExpired = s.expiry_ns / MILLISECOND_IN_NANOSECONDS <= BigInt(Date.now());

			// A settled series can still live in the registry after clearing drops
			// it from its `SERIES` cache (see icdc-core: series is removed from
			// the clearing map on `Finalised`, but the registry keeps it). Overlay
			// the `SETTLEMENT` activity so the markets list agrees with the market
			// detail page on `Resolved` state.
			const status: MarketStatus = isResolved ? 'Resolved' : isExpired ? 'Expired' : 'Open';
			const outcome: Outcome | undefined = resolution?.outcome;

			if (isCategorical && nonNullish(s.outcomes?.[0])) {
				const orders = await listOrdersApi({
					identity,
					certified,
					params: { series_id: toNullable(mid) }
				});
				const categoricalProbabilities = calculateCategoricalProbabilities({
					outcomes: s.outcomes[0],
					orders
				});

				return mapMarketData({
					series: s,
					yesProbability: 0.5,
					noProbability: 0.5,
					status,
					outcome,
					categoricalProbabilities
				});
			}

			const orders = await getOrderBook({
				marketId: mid,
				domain: s.balance_domain,
				identity,
				certified
			});
			const { midPrice, bids, asks } = calculateMarketStats({
				orders,
				outcome: 'YES'
			});

			const yesProb = midPrice ?? 0.5;

			return mapMarketData({
				series: s,
				yesProbability: yesProb,
				noProbability: 1 - yesProb,
				bestBid: bids[0]?.price,
				bestAsk: asks[0]?.price,
				bestBidQty: bids[0]?.totalQty,
				bestAskQty: asks[0]?.totalQty,
				status,
				outcome
			});
		})
	);

	// Add resolved markets that are no longer in the registry at all.
	const resolvedSeriesIds = Object.keys(resolutionMap);
	const activeSeriesIds = new Set(seriesList.map((s) => s.series_id));

	const resolvedMarkets = await Promise.all(
		resolvedSeriesIds
			.filter((id) => !activeSeriesIds.has(id))
			.map(async (id) => {
				const series = await getSeries({ identity, certified, seriesId: id });

				if (isNullish(series)) {
					return;
				}

				return mapMarketData({
					series,
					status: 'Resolved',
					outcome: resolutionMap[id].outcome
				});
			})
	);

	const items = [...markets, ...resolvedMarkets].filter(nonNullish);

	return filterByPlaygroundExpandedDomain({ items, targetDomain: domain });
};

/**
 * Extracts a `seriesId -> { outcome }` map from Juno settlement activities.
 * Details are expected to be stringified JSON (`{ outcome, price }`); malformed
 * entries are skipped so they do not block the rest of the market list.
 */
const buildResolutionMap = (activities: Activity[]): Record<string, { outcome: Outcome }> =>
	activities
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

/**
 * Loads series for the current domain, enriches with order book stats, merges resolved markets
 * from activity, and filters by domain. In playground mode (ViciXp), Social markets are included.
 *
 * Performs a single certified update. Prefer {@link loadMarkets} for UI flows that
 * should render a fast uncertified result first and upgrade once certified data arrives.
 */
export const getMarkets = async (domain: RegistryDid.BalanceDomain): Promise<Market[]> => {
	const identity = await getIdentityOrAnonymous();

	return fetchMarkets({ identity, certified: true, domain });
};

/**
 * Callback-based variant of {@link getMarkets} built on `queryAndUpdate`: fires
 * `onLoad` up to twice — once with the fast uncertified query result, then again
 * with the certified update result. The underlying utility drops stale query
 * responses that arrive after the update has settled, so callers can safely
 * overwrite their sink on every invocation.
 */
export const loadMarkets = ({
	domain,
	onLoad,
	onUpdateError
}: {
	domain: RegistryDid.BalanceDomain;
	onLoad: (options: { certified: boolean; response: Market[] }) => void;
	onUpdateError?: (error: unknown) => void;
}): Promise<void> =>
	loadWithCertification<Market[]>({
		request: ({ certified, identity }) => fetchMarkets({ identity, certified, domain }),
		onLoad,
		onUpdateError
	});

/**
 * Core single-market fetch: threads identity + certified so it composes with
 * {@link loadMarket} / `queryAndUpdate`.
 */
const fetchMarket = async ({
	identity,
	certified,
	marketId
}: {
	identity: Identity;
	certified: boolean;
	marketId: MarketId;
}): Promise<Market | undefined> => {
	const [s, rawOrders, activities] = await Promise.all([
		getSeries({ identity, certified, seriesId: marketId }),
		getOrderBook({ marketId, identity, certified }),
		getGlobalActivities({ certified })
	]);

	const { midPrice, bids, asks } = calculateMarketStats({
		orders: rawOrders,
		outcome: 'YES'
	});

	const yesProb = midPrice ?? 0.5;
	const noProb = 1 - yesProb;

	const bestBid = bids[0]?.price;
	const bestAsk = asks[0]?.price;
	const bestBidQty = bids[0]?.totalQty;
	const bestAskQty = asks[0]?.totalQty;

	if (isNullish(s)) {
		return;
	}

	const isCategorical = 'Categorical' in s.payoff_type;
	const categoricalProbabilities: Record<string, number> | undefined =
		isCategorical && nonNullish(s.outcomes?.[0])
			? calculateCategoricalProbabilities({
					outcomes: s.outcomes[0],
					orders: await listOrdersApi({
						identity,
						certified,
						params: { series_id: toNullable(marketId) }
					})
				})
			: undefined;

	const resolution = activities.find(
		(a) => a.type === ActivityType.SETTLEMENT && a.marketId === marketId
	);

	const parseResolutionOutcome = (details: string | undefined): Outcome | undefined => {
		try {
			const { outcome: settlementOutcome } = JSON.parse(details ?? '{}');

			return settlementOutcome;
		} catch (e) {
			// Malformed settlement details should not block rendering the rest of the market; log and fall through so the market appears resolved without an outcome label.
			console.error('Failed to parse outcome from activity', e);
		}
	};

	const status: MarketStatus = nonNullish(resolution)
		? 'Resolved'
		: s.expiry_ns / MILLISECOND_IN_NANOSECONDS <= BigInt(Date.now())
			? 'Expired'
			: 'Open';
	const outcome: Outcome | undefined = nonNullish(resolution)
		? parseResolutionOutcome(resolution.details)
		: undefined;

	return mapMarketData({
		series: s,
		yesProbability: yesProb,
		noProbability: noProb,
		bestBid,
		bestAsk,
		bestBidQty,
		bestAskQty,
		status,
		outcome,
		categoricalProbabilities
	});
};

/**
 * Single-market detail with book, categorical probabilities if applicable, and resolution status from activity.
 *
 * Performs a single certified update. Prefer {@link loadMarket} for UI flows
 * that should render fast then upgrade once verified.
 */
export const getMarket = async (marketId: MarketId): Promise<Market | undefined> => {
	const identity = await getIdentityOrAnonymous();

	return fetchMarket({ identity, certified: true, marketId });
};

/**
 * Callback-based variant of {@link getMarket} that fires `onLoad` up to twice:
 * once for the uncertified query, then again for the certified update. Stale
 * query responses that arrive after the update has settled are dropped by the
 * underlying `queryAndUpdate`.
 */
export const loadMarket = ({
	marketId,
	onLoad,
	onUpdateError
}: {
	marketId: MarketId;
	onLoad: (options: { certified: boolean; response: Market | undefined }) => void;
	onUpdateError?: (error: unknown) => void;
}): Promise<void> =>
	loadWithCertification<Market | undefined>({
		request: ({ certified, identity }) => fetchMarket({ identity, certified, marketId }),
		onLoad,
		onUpdateError
	});

/**
 * Ranks markets based on user interests, category relevance (culture fallback),
 * activity (volume), and recency.
 */
export const rankMarkets = ({
	markets,
	userInterests,
	categoryMappings
}: {
	markets: Market[];
	userInterests: Set<string>;
	categoryMappings: SeriesCategory[];
}): Market[] => {
	const marketCategoryMap = new Map<string, string>(
		categoryMappings.map((m) => [m.seriesId, m.categoryId])
	);

	const computeScore = (m: Market): number => {
		const categoryId = marketCategoryMap.get(m.id);

		// 1. User Interests (High Priority)
		const interestScore = nonNullish(categoryId) && userInterests.has(categoryId) ? 1000 : 0;

		// 2. Culture Fallback (Discovery Boost)
		// Boost culture if user has interest in it or if user has NO interests at all
		const cultureScore =
			categoryId === 'culture' && (userInterests.size === 0 || userInterests.has('culture'))
				? 500
				: 0;

		// 3. Activity / Trending (Volume-based)
		// Small boost based on total volume (normalized to ~100 max for typical early liquidity)
		const volumeScore =
			m.totalVolume > ZERO
				? Math.min(
						decimalFixedValueToNumber({
							value: m.totalVolume,
							decimals: Number(m.token.decimals)
						}) * 2,
						200
					)
				: 0;

		// 4. Relevance / Liquidity
		// Boost if both sides of the book are populated
		const liquidityScore = nonNullish(m.bestBid) && nonNullish(m.bestAsk) ? 100 : 0;

		// 5. Recency (Tie-breaker)
		// Scaled createdAt to provide stable sequence within same score brackets
		const recencyScore = Number(m.createdAt) / 1e12;

		return interestScore + cultureScore + volumeScore + liquidityScore + recencyScore;
	};

	return markets
		.map((m) => ({ market: m, score: computeScore(m) }))
		.sort((a, b) => b.score - a.score)
		.map(({ market }) => market);
};

/**
 * Open binary markets ranked for the prediction flow UI using profile interests and categories.
 */
export const getFlowQueue = async (domain: RegistryDid.BalanceDomain): Promise<Market[]> => {
	const identity = await getIdentityOrAnonymous();
	const principal = identity.getPrincipal().toText();

	const [markets, profile, categoryMappings] = await Promise.all([
		getMarkets(domain),
		getProfile(principal),
		listSeriesCategories()
	]);

	const userInterests = new Set(profile.data.interests ?? []);

	// Filter for binary/open markets for the flow session
	const eligibleMarkets = markets.filter((m) => m.status === 'Open' && m.payoffType === 'Binary');

	return rankMarkets({
		markets: eligibleMarkets,
		userInterests,
		categoryMappings
	});
};

/**
 * Forks an existing market into a new restricted-access clone ("circle match").
 *
 * Uses the registry's `fork_series` endpoint so the resulting market carries a
 * `forked_from` reference back to the source. This lineage is what powers the
 * stacked-card UI and lets us enforce per-user fork limits on the backend.
 *
 * The fork inherits the source's title, description, outcomes, expiry,
 * balance domain, payout unit, etc. — the caller only supplies the target
 * group(s) and (optionally) a custom title/description.
 */
export const forkMarket = async ({
	marketId,
	groupIds,
	title,
	description
}: {
	marketId: MarketId;
	groupIds: string[];
	title?: string;
	description?: string;
}): Promise<string> => {
	if (groupIds.length === 0) {
		throw new Error('Fork requires at least one target group');
	}

	const identity = await safeGetIdentityOnce();

	const params: RegistryDid.ForkSeriesParams = {
		source_series_id: marketId,
		title: toNullable(title),
		description: toNullable(
			nonNullish(description) ? { plain: description, html: [], markdown: [] } : undefined
		),
		trading_access: [{ Restricted: { groups: groupIds } }],
		engine_id: toNullable(VICI_ENGINE_ID)
	};

	return await forkSeries({ identity, params });
};
