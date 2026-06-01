import type { ClearingDid, RegistryDid } from '$declarations';
import {
	getPositions as getPositionsApi,
	getTradeHistory as getTradeHistoryApi,
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
 * Real price-history series for one market, sourced from the caller's
 * trade history on the clearing canister.
 *
 * Reuses the same certified fetch path as {@link loadUserTradeHistory},
 * then derives a chronological YES-percentage series for `seriesId` via
 * {@link deriveMarketPriceHistory}. The series is genuine market history,
 * not synthetic jitter, and is empty until the viewer has executed a
 * trade on the market (true cold-start). No-op when signed out — the
 * caller keeps its cold-start flat line.
 */
export const loadMarketPriceHistory = async ({
	seriesId,
	domain,
	onLoad,
	onUpdateError
}: {
	seriesId: string;
	domain: RegistryDid.BalanceDomain;
	onLoad: (options: { certified: boolean; response: number[] }) => void;
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
		onLoad: ({ certified, response }) => {
			onLoad({ certified, response: deriveMarketPriceHistory({ events: response, seriesId }) });
		},
		onUpdateError
	});
};

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
