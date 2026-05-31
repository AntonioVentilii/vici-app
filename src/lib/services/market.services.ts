import type { RegistryDid } from '$declarations';
import { listOrders as listOrdersApi } from '$lib/api/clearing.api';
import { addSeries, forkSeries, getSeries, listSeries } from '$lib/api/registry.api';
import {
	MILLISECOND_IN_NANOSECONDS,
	PAYOFF_TYPE,
	PRICE_DECIMALS,
	STRIKE,
	VICI_ORACLE_V1
} from '$lib/constants/app.constants';
import { VICI_ENGINE_ID } from '$lib/constants/icdc.constants';
import type { AppLocale } from '$lib/constants/locale.constants';
import type { MarketTag } from '$lib/constants/market-tags.constants';
import { ActivityType } from '$lib/enums/social';
import { UserRole } from '$lib/enums/user';
import { getGlobalActivities, logActivity } from '$lib/services/activity.services';
import { getIdentityOrAnonymous, safeGetIdentityOnce } from '$lib/services/identity.services';
import {
	listMarketMetadataBySeries,
	listMarketTagsBySeries
} from '$lib/services/market-tags.services';
import { getOrderBook } from '$lib/services/order.services';
import { getProfile } from '$lib/services/profile.services';
import { loadWithCertification } from '$lib/services/query-update.services';
import type { Market, MarketId, MarketStatus, Outcome } from '$lib/types/market';
import type { MarketMetadata } from '$lib/types/market-metadata';
import type { Activity } from '$lib/types/social';
import { filterByPlaygroundExpandedDomain } from '$lib/utils/balance-domain.utils';
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
	tradingAccess = [{ Open: null }],
	locale
}: {
	title: string;
	description: string;
	expiryDate: bigint;
	outcomes?: string[];
	payoutUnit?: RegistryDid.PayoutUnit;
	socialReward?: { title: string; description?: string; iconUrl?: string };
	balanceDomain: RegistryDid.BalanceDomain;
	tradingAccess?: RegistryDid.TradingAccess[];
	/**
	 * BCP 47 source language of `title`, `description`, `outcomes`, and
	 * `socialReward`. Stored as metadata on the registry; the canister never
	 * stores translations and treats `None` as `"en"` by default. Off-chain
	 * translations (see `MARKET_TRANSLATIONS` collection) overlay this source
	 * for each user's preferred locale.
	 */
	locale?: AppLocale;
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

	// Mirrors the on-chain invariant enforced by the registry (`SocialMarketMustBeRestricted`):
	// a Social market must have at least one `Restricted` policy and may not contain `Open`.
	// Catching it here surfaces a deterministic error to callers instead of an opaque
	// `Failed to add series: {SocialMarketMustBeRestricted: null}` from the canister.
	if (
		isSocialMarket &&
		(tradingAccess.length === 0 || !tradingAccess.every((ta) => 'Restricted' in ta))
	) {
		throw new Error(
			'Social challenges must be restricted to a group (friends or a custom group). ' +
				'Public social challenges are not supported by the registry.'
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
		engine_id: isEngineCreator ? toNullable(VICI_ENGINE_ID) : toNullable(),
		// BCP 47 source language of the human-readable fields above. `undefined`
		// → `None` on chain, which the canister treats as `"en"`.
		locale: toNullable(locale)
	};

	const seriesId = await addSeries({
		identity,
		params
	});

	await logActivity({
		type: ActivityType.TRADE,
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
	const [allSeries, activities] = await Promise.all([
		listSeries({ identity, certified }),
		getGlobalActivities({ certified })
	]);

	// TODO(temporary): until multiple-choice (categorical) markets are fully
	// supported across the UI, only surface binary (boolean) markets. Check the
	// variant explicitly so Call / Put / future payoff types stay out too.
	// Remove this filter to restore non-binary markets.
	const seriesList = allSeries.filter((s) => 'Binary' in s.payoff_type);

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

	const resolvedSeriesIds = Object.keys(resolutionMap);
	// Derive from the unfiltered list: a resolved non-binary series still in
	// `listSeries` is already accounted for, so skip a redundant `getSeries`
	// fetch that the `Binary` guard below would only discard.
	const activeSeriesIds = new Set(allSeries.map((s) => s.series_id));

	const resolvedMarkets = await Promise.all(
		resolvedSeriesIds
			.filter((id) => !activeSeriesIds.has(id))
			.map(async (id) => {
				const series = await getSeries({ identity, certified, seriesId: id });

				if (isNullish(series)) {
					return;
				}

				// See the binary-only TODO above: skip settled non-binary series too.
				if (!('Binary' in series.payoff_type)) {
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
 * Cheap variant of {@link fetchMarkets} used by the Flow ranking path:
 * builds `Market` view-models straight from the series list + activity
 * resolution map, *without* a per-market `getOrderBook` call. Resolved-
 * only series (present in activities but no longer in `listSeries`) are
 * also skipped — Flow filters them out anyway.
 *
 * This is what kills the N+1 fan-out on `/flow` entry: ranking only
 * needs tags / metadata / interests, so the orderbook stays unfetched
 * until {@link enrichMarketsWithOrderBook} is called on the top-N
 * winners after the rank.
 */
const fetchOpenBinaryMarketsLite = async ({
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
	const nowNs = BigInt(Date.now()) * MILLISECOND_IN_NANOSECONDS;

	const markets = seriesList
		.filter((s) => {
			const isResolved = nonNullish(resolutionMap[s.series_id]);
			const isExpired = s.expiry_ns <= nowNs;
			// Flow only shows Binary markets. Check the variant
			// explicitly so Call / Put / future payoff types stay out.
			const isBinary = 'Binary' in s.payoff_type;

			return !isResolved && !isExpired && isBinary;
		})
		// Lite mapping: seed `yesProbability`/`noProbability` at 0.5 (vs
		// `mapMarketData`'s default of 0) so a card that misses
		// enrichment — e.g. its order-book fetch fails in
		// `enrichMarketsWithOrderBook` — still renders the neutral
		// consensus instead of 0%/100%.
		.map((s) =>
			mapMarketData({ series: s, status: 'Open', yesProbability: 0.5, noProbability: 0.5 })
		)
		.filter(nonNullish);

	return filterByPlaygroundExpandedDomain({ items: markets, targetDomain: domain });
};

/**
 * Adds book-derived fields (`yesProbability`, `noProbability`,
 * `bestBid`/`bestAsk`) to lite `Market` objects produced by
 * {@link fetchOpenBinaryMarketsLite}. Called by the Flow path on just
 * the top-N ranked markets so we pay for at most `MAX_MARKETS` round-
 * trips instead of one per open series.
 */
const enrichMarketsWithOrderBook = ({
	markets,
	identity,
	certified
}: {
	markets: Market[];
	identity: Identity;
	certified: boolean;
}): Promise<Market[]> =>
	Promise.all(
		markets.map(async (market) => {
			const orders = await getOrderBook({
				marketId: market.id,
				domain: market.balanceDomain,
				identity,
				certified
			}).catch((e: unknown) => {
				// A single failed book read should not collapse the whole deck —
				// fall back to the neutral 0.5 prob the lite mapper assigned and
				// let the rest of the cards render. The failing market still
				// shows with no liquidity indicator.
				console.error('Failed to fetch order book for flow market', market.id, e);

				return [] as Awaited<ReturnType<typeof getOrderBook>>;
			});

			const { midPrice, bids, asks } = calculateMarketStats({
				orders,
				outcome: 'YES'
			});

			const yesProb = midPrice ?? 0.5;

			return {
				...market,
				yesProbability: yesProb,
				noProbability: 1 - yesProb,
				bestBid: bids[0]?.price,
				bestAsk: asks[0]?.price,
				bestBidQty: bids[0]?.totalQty,
				bestAskQty: asks[0]?.totalQty
			};
		})
	);

/**
 * Extracts a `seriesId -> { outcome }` map from Juno settlement activities.
 * Details are expected to be stringified JSON (`{ outcome, price }`); malformed
 * entries are skipped so they do not block the rest of the market list.
 */
const buildResolutionMap = (activities: Activity[]): Record<string, { outcome?: Outcome }> =>
	activities
		.filter((a) => a.type === ActivityType.SETTLEMENT && nonNullish(a.marketId))
		.reduce<Record<string, { outcome?: Outcome }>>((acc, a) => {
			const { marketId, details } = a;

			if (!nonNullish(marketId)) {
				return acc;
			}

			// The activity row itself is the source of truth for "this market is
			// resolved" — do NOT drop the entry just because the JSON payload is
			// malformed or missing, otherwise `fetchMarkets` (list) and
			// `fetchMarket` (detail) disagree: detail already degrades gracefully
			// to `status = 'Resolved'` with `outcome = undefined`, and the list
			// must do the same.
			let outcome: Outcome | undefined;

			try {
				const parsed = JSON.parse(details ?? '{}');
				outcome =
					typeof parsed?.outcome === 'string' && parsed.outcome.length > 0
						? parsed.outcome
						: undefined;
			} catch (e: unknown) {
				console.error('Failed to parse settlement details', e);
			}

			acc[marketId] = { outcome };

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
		} catch (e: unknown) {
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
 * Editorial-boost magnitude for markets flipped to `suggested = true`.
 * Sits above the interest tier (1000) and the culture-fallback tier
 * (500) so a single admin flag dominates every organic ranking signal
 * — but stays additive, so two suggested markets still order by
 * volume / liquidity / recency between themselves.
 */
const SUGGESTED_BOOST_BASE = 5000;

/**
 * Linear decay window for the suggested boost. After this many ms the
 * editorial weight is fully gone and the market falls back to its
 * organic rank — no admin maintenance required to un-suggest stale
 * picks. Tracked from `metadata.updatedAt` (set on every metadata
 * upsert in `market-metadata.services.ts`).
 */
const SUGGESTED_DECAY_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Resolves the editorial-boost score for a market. Returns `0` for any
 * of the three "should not promote" cases:
 *   - no metadata, or `suggested === false`
 *   - the market is no longer Open (auto-drop on `Expired` / `Resolved`)
 *   - the boost has fully decayed (older than {@link SUGGESTED_DECAY_MS})
 *
 * Exported so the "Suggested for you" rail (which only wants markets
 * with a non-zero current boost) reuses the same gating rules as the
 * sort tier — single source of truth, no chance of the rail showing a
 * market that the sort already let fall off the top.
 */
export const suggestedScore = ({
	market,
	metadata,
	nowMs = Date.now()
}: {
	market: Market;
	metadata: MarketMetadata | undefined;
	nowMs?: number;
}): number => {
	if (!metadata?.suggested) {
		return 0;
	}

	if (market.status !== 'Open') {
		return 0;
	}

	const ageMs = Math.max(0, nowMs - metadata.updatedAt);
	const remaining = 1 - ageMs / SUGGESTED_DECAY_MS;

	if (remaining <= 0) {
		return 0;
	}

	return SUGGESTED_BOOST_BASE * remaining;
};

/**
 * Ranks markets by editorial signal first (admin-flipped `suggested`,
 * linearly decayed over 14 days and auto-dropped on resolve), then
 * user interest, then a culture-fallback boost (so users with no
 * declared interests still get a meaningful feed), with `createdAt`
 * as the final tie-breaker.
 *
 * Earlier revisions also weighted `volumeScore` and `liquidityScore`.
 * Both were removed: `volumeScore` keyed off `Market.totalVolume`,
 * which `mapMarketData` hardcodes to `ZERO` (the field is never
 * populated upstream), so it never contributed. `liquidityScore`
 * needed `bestBid` / `bestAsk`, which the Flow path no longer fetches
 * until *after* ranking — see `getFlowQueue` +
 * `enrichFlowMarketsWithOrderBook`. The dropped tier was a 100-point
 * flag dwarfed by the interest (1000) and suggested (~5000) tiers, so
 * the top-N ordering is effectively unchanged.
 *
 * `tagMappings` is the `seriesId → MarketTag[]` projection produced by
 * {@link listMarketTagsBySeries}; a market matches user interest when
 * *any* of its tags is in the user's declared interest set. The
 * `culture` boost is unchanged from the legacy single-category logic —
 * it now fires when the market carries the `culture` tag and the user
 * either has no interests or explicitly opted into culture.
 *
 * `metadataBySeries` (optional) carries the full `MarketMetadata` doc
 * keyed by `seriesId`. When omitted, the suggested-market boost
 * silently no-ops — every other tier behaves identically, so callers
 * that haven't been migrated to pass metadata see no regression.
 */
export const rankMarkets = ({
	markets,
	userInterests,
	tagMappings,
	metadataBySeries = {}
}: {
	markets: Market[];
	userInterests: Set<string>;
	tagMappings: Record<string, MarketTag[]>;
	metadataBySeries?: Record<string, MarketMetadata>;
}): Market[] => {
	const nowMs = Date.now();

	const computeScore = (m: Market): number => {
		const tags = tagMappings[m.id] ?? [];

		const suggested = suggestedScore({ market: m, metadata: metadataBySeries[m.id], nowMs });

		const interestScore = tags.some((tag) => userInterests.has(tag)) ? 1000 : 0;

		const hasCultureTag = tags.includes('culture');
		const cultureScore =
			hasCultureTag && (userInterests.size === 0 || userInterests.has('culture')) ? 500 : 0;

		// `liquidityScore` and `volumeScore` used to live here but were
		// dropped: `volumeScore` keyed off `Market.totalVolume`, which
		// `mapMarketData` hardcodes to `ZERO`, so it never fired. And
		// the Flow ranking path now ranks before fetching order books
		// (see `getFlowQueue` + `enrichMarketsWithOrderBook`), so
		// `bestBid`/`bestAsk` aren't populated at sort time anyway.
		const recencyScore = Number(m.createdAt) / 1e12;

		return suggested + interestScore + cultureScore + recencyScore;
	};

	return markets
		.map((m) => ({ market: m, score: computeScore(m) }))
		.sort((a, b) => b.score - a.score)
		.map(({ market }) => market);
};

/**
 * Open binary markets ranked for the prediction flow UI using profile
 * interests and categories.
 *
 * The returned markets are *lite*: ranking only needs tags + metadata
 * + interests, so no `getOrderBook` calls are issued here. Callers
 * that want book-derived fields (`yesProbability`, `bestBid`/`bestAsk`)
 * for the cards they actually render should call
 * {@link enrichFlowMarketsWithOrderBook} on the final slice. This is
 * what cuts `/flow` entry from "N order-book fetches over every open
 * series" to "≤MAX_MARKETS book fetches over the top-N winners".
 *
 * `tagMappings` and `metadataBySeries` are optional pre-fetched
 * inputs: callers that already hold these (e.g. `prepareFlow`, which
 * shares them with the signals derivation) can pass them in to avoid
 * a duplicate satellite round-trip. Plain values, promises, or
 * promise-wrapped results all work — `Promise.all` collapses them.
 */
export const getFlowQueue = async ({
	domain,
	tagMappings,
	metadataBySeries
}: {
	domain: RegistryDid.BalanceDomain;
	tagMappings?: Record<string, MarketTag[]> | Promise<Record<string, MarketTag[]>>;
	metadataBySeries?: Record<string, MarketMetadata> | Promise<Record<string, MarketMetadata>>;
}): Promise<Market[]> => {
	const identity = await getIdentityOrAnonymous();
	const principal = identity.getPrincipal().toText();

	const [markets, profile, resolvedTags, resolvedMeta] = await Promise.all([
		fetchOpenBinaryMarketsLite({ identity, certified: true, domain }),
		getProfile(principal),
		tagMappings ?? listMarketTagsBySeries().catch(() => ({})),
		metadataBySeries ?? listMarketMetadataBySeries().catch(() => ({}))
	]);

	const userInterests = new Set(profile.data.interests ?? []);

	return rankMarkets({
		markets,
		userInterests,
		tagMappings: resolvedTags,
		metadataBySeries: resolvedMeta
	});
};

/**
 * Public wrapper around {@link enrichMarketsWithOrderBook} for the Flow
 * pipeline. Resolves the identity once and fans out one parallel book
 * fetch per market — meant to be called with the already-sliced top-N
 * (see `MAX_MARKETS` in `flow-prep.services.ts`), so the network cost
 * is bounded by deck size instead of the number of open series.
 */
export const enrichFlowMarketsWithOrderBook = async (markets: Market[]): Promise<Market[]> => {
	if (markets.length === 0) {
		return markets;
	}

	const identity = await getIdentityOrAnonymous();

	return enrichMarketsWithOrderBook({ markets, identity, certified: true });
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
	description,
	locale
}: {
	marketId: MarketId;
	groupIds: string[];
	title?: string;
	description?: string;
	/**
	 * Optional BCP 47 source-language override for the forked market's
	 * `title`/`description`. When omitted, the registry inherits the source
	 * series' locale, which is what we want for non-translating "Challenge
	 * your friends" forks. Pass an explicit value only when the fork
	 * intentionally retitles into a different language.
	 */
	locale?: AppLocale;
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
		engine_id: toNullable(VICI_ENGINE_ID),
		locale: toNullable(locale)
	};

	return await forkSeries({ identity, params });
};
