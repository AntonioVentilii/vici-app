/* eslint-disable require-await,require-await */

import { addSeries, getSeries, listSeries } from '$lib/api/registry.api';
import { PAYOFF_TYPE, STRIKE, VICI_ORACLE_V1 } from '$lib/constants/app.constants';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import type { Market, MarketId } from '$lib/types/market';
import { mapMarketData } from '$lib/utils/market.utils';
import { isNullish } from '@dfinity/utils';

// TODO: revisit
export const createMarket = async ({
	title,
	description,
	expiryDate,
	isInviteOnly = false
}: {
	title: string;
	description: string;
	expiryDate: bigint;
	isInviteOnly?: boolean;
}): Promise<string> => {
	const identity = await safeGetIdentityOnce();

	const seriesId = await addSeries({
		identity,
		params: {
			underlying: title,
			expiry: expiryDate,
			// TODO: support different settlement assets, for now we can default to ICP
			settlement_asset: { Icp: null },
			strike: STRIKE,
			payoff_type: PAYOFF_TYPE,
			oracle_source: VICI_ORACLE_V1
		}
	});

	// TODO: re-trigger the market loading to show the newly created market in the UI

	return seriesId;
};

export const getMarkets = async (): Promise<Market[]> => {
	const identity = await safeGetIdentityOnce();

	const seriesList = await listSeries({ identity });

	return seriesList.map(mapMarketData);
};

export const getMarket = async (marketId: MarketId): Promise<Market | undefined> => {
	const identity = await safeGetIdentityOnce();

	const s = await getSeries({ identity, seriesId: marketId });

	if (isNullish(s)) {
		return;
	}

	return mapMarketData(s);
};

export const getRushQueue = async (): Promise<Market[]> => {
	throw Error('Rush queue not implemented yet');
};
