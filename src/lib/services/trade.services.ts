import type { ClearingDid, RegistryDid } from '$declarations';
import {
	getPositions as getPositionsApi,
	getTradeHistory as getTradeHistoryApi,
	mintCompleteSet as mintCompleteSetApi,
	redeemCompleteSet as redeemCompleteSetApi
} from '$lib/api/clearing.api';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { getMarkets } from '$lib/services/market.services';
import { filterByMarketIds } from '$lib/utils/balance-domain.utils';

/** Clearing position for one series, if any. */
export const getPosition = async (seriesId: string): Promise<ClearingDid.Position | undefined> => {
	const identity = await safeGetIdentityOnce();

	const positions = await getPositionsApi({
		identity
	});

	return positions.find((p) => p.series_id === seriesId);
};

/** Trade/settlement events for the user, restricted to markets visible in the current app domain. */
export const getUserTradeHistory = async (
	domain: RegistryDid.BalanceDomain
): Promise<ClearingDid.Event[]> => {
	const identity = await safeGetIdentityOnce();

	const [events, markets] = await Promise.all([
		getTradeHistoryApi({ identity }),
		getMarkets(domain)
	]);

	const marketIds = new Set(markets.map((m) => m.id));

	return filterByMarketIds({ items: events, marketIds });
};

/** Mints a complete YES/NO set on clearing for `qty`. */
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

/** Redeems a complete set back into collateral for `qty`. */
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
