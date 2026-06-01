import type { ClearingDid, RegistryDid } from '$declarations';
import {
	getPositions as getPositionsApi,
	getTradeHistory as getTradeHistoryApi,
	listSeriesTradeHistory as listSeriesTradeHistoryApi,
	mintCompleteSet as mintCompleteSetApi,
	redeemCompleteSet as redeemCompleteSetApi
} from '$lib/api/clearing.api';
import { getIdentity, safeGetIdentityOnce } from '$lib/services/identity.services';
import { getMarkets } from '$lib/services/market.services';
import { loadWithCertification } from '$lib/services/query-update.services';
import { filterByMarketIds } from '$lib/utils/balance-domain.utils';
import { deriveMarketPriceHistory } from '$lib/utils/market-price-history.utils';
import { isNullish } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';

// Cap on how many trade-history pages a single sparkline load drains. The
// canister returns all remaining trades when `limit` is unset, so one page
// is normally enough; the bound is a guard against a pathologically long
// series fanning out into unbounded round-trips.
const PRICE_HISTORY_MAX_PAGES = 8;

/**
 * Core fetch for a single-series position: threads identity + certified so it
 * composes with {@link loadPosition} / `queryAndUpdate`.
 */
const fetchPosition = async ({
	identity,
	certified,
	seriesId
}: {
	identity: Identity;
	certified: boolean;
	seriesId: string;
}): Promise<ClearingDid.Position | undefined> => {
	const positions = await getPositionsApi({ identity, certified });

	return positions.find((p) => p.series_id === seriesId);
};

/**
 * Clearing position for one series, if any.
 *
 * Performs a single certified update. Prefer {@link loadPosition} for UI flows
 * that should render fast then upgrade to a certified result.
 */
export const getPosition = async (seriesId: string): Promise<ClearingDid.Position | undefined> => {
	const identity = await safeGetIdentityOnce();

	return fetchPosition({ identity, certified: true, seriesId });
};

/**
 * Callback-based variant of {@link getPosition}. No-op when the user is not
 * signed in.
 */
export const loadPosition = async ({
	seriesId,
	onLoad,
	onUpdateError
}: {
	seriesId: string;
	onLoad: (options: { certified: boolean; response: ClearingDid.Position | undefined }) => void;
	onUpdateError?: (error: unknown) => void;
}): Promise<void> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return;
	}

	return loadWithCertification<ClearingDid.Position | undefined>({
		identity,
		request: ({ certified, identity: reqIdentity }) =>
			fetchPosition({ identity: reqIdentity, certified, seriesId }),
		onLoad,
		onUpdateError
	});
};

/**
 * Core fetch for user trade history, restricted to the current app domain.
 */
const fetchUserTradeHistory = async ({
	identity,
	certified,
	domain
}: {
	identity: Identity;
	certified: boolean;
	domain: RegistryDid.BalanceDomain;
}): Promise<ClearingDid.Event[]> => {
	const [events, markets] = await Promise.all([
		getTradeHistoryApi({ identity, certified }),
		// getMarkets internally performs a certified update; the trade history
		// would otherwise tear against the market set.
		getMarkets(domain)
	]);

	const marketIds = new Set(markets.map((m) => m.id));

	return filterByMarketIds({ items: events, marketIds });
};

/**
 * Trade/settlement events for the user, restricted to markets visible in the current app domain.
 *
 * Performs a single certified update. Prefer {@link loadUserTradeHistory} for
 * UI flows that benefit from the fast-then-certified render pattern.
 */
export const getUserTradeHistory = async (
	domain: RegistryDid.BalanceDomain
): Promise<ClearingDid.Event[]> => {
	const identity = await safeGetIdentityOnce();

	return fetchUserTradeHistory({ identity, certified: true, domain });
};

/**
 * Callback-based variant of {@link getUserTradeHistory}. No-op when the user
 * is not signed in.
 */
export const loadUserTradeHistory = async ({
	domain,
	onLoad,
	onUpdateError
}: {
	domain: RegistryDid.BalanceDomain;
	onLoad: (options: { certified: boolean; response: ClearingDid.Event[] }) => void;
	onUpdateError?: (error: unknown) => void;
}): Promise<void> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return;
	}

	return loadWithCertification<ClearingDid.Event[]>({
		identity,
		request: ({ certified, identity: reqIdentity }) =>
			fetchUserTradeHistory({ identity: reqIdentity, certified, domain }),
		onLoad,
		onUpdateError
	});
};

/**
 * Real, market-wide price-history series for one market, sourced from the
 * clearing canister's `list_series_trade_history` query.
 *
 * The query is market-wide (not caller-scoped), so the derived
 * YES-percentage series reflects the TRUE market movement for every viewer
 * — including signed-out visitors, who read it under the anonymous identity
 * — rather than the viewer's own fills. {@link deriveMarketPriceHistory}
 * maps each executed trade's price into the 0–100 series. The series is
 * empty until the first trade lands on the market (true cold-start), which
 * the sparkline reads as a flat line. Fails open: any error leaves the
 * caller on its cold-start / seed fallback.
 */
export const loadMarketPriceHistory = ({
	seriesId,
	onLoad,
	onUpdateError
}: {
	seriesId: string;
	onLoad: (options: { certified: boolean; response: number[] }) => void;
	onUpdateError?: (error: unknown) => void;
}): Promise<void> =>
	loadWithCertification<ClearingDid.SeriesTradePoint[]>({
		request: ({ certified, identity: reqIdentity }) =>
			listSeriesTradeHistoryApi({
				identity: reqIdentity,
				seriesId,
				maxPages: PRICE_HISTORY_MAX_PAGES,
				certified
			}),
		onLoad: ({ certified, response }) => {
			onLoad({ certified, response: deriveMarketPriceHistory(response) });
		},
		onUpdateError
	});

/**
 * Mints a complete YES/NO set on clearing for `qty`.
 */
export const mintCompleteSet = async ({
	seriesId,
	qty
}: {
	seriesId: string;
	qty: bigint;
}): Promise<boolean> => {
	const identity = await safeGetIdentityOnce();

	return await mintCompleteSetApi({
		identity,
		seriesId,
		qty
	});
};

/**
 * Redeems a complete set back into collateral for `qty`.
 */
export const redeemCompleteSet = async ({
	seriesId,
	qty
}: {
	seriesId: string;
	qty: bigint;
}): Promise<boolean> => {
	const identity = await safeGetIdentityOnce();

	return await redeemCompleteSetApi({
		identity,
		seriesId,
		qty
	});
};
