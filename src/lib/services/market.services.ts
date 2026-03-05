import { addSeries, getSeries, listSeries } from '$lib/api/registry.api';
import { PAYOFF_TYPE, STRIKE, VICI_ORACLE_V1 } from '$lib/constants/app.constants';
import { logActivity } from '$lib/services/activity.services';
import { getIdentityOrAnonymous, safeGetIdentityOnce } from '$lib/services/identity.services';
import { getProfile } from '$lib/services/profile.services';
import type { Market, MarketId } from '$lib/types/market';
import { ActivityType } from '$lib/types/social';
import { UserRole } from '$lib/types/user';
import { mapMarketData } from '$lib/utils/market.utils';
import { emitRefreshMarkets } from '$lib/utils/refresh.utils';
import { isNullish } from '@dfinity/utils';

/**
 * Creates a new prediction market.
 * Only Admins and Creators are authorized.
 */
export const createMarket = async ({
	title,
	description,
	expiryDate
}: {
	title: string;
	description: string;
	expiryDate: bigint;
}): Promise<string> => {
	const identity = await safeGetIdentityOnce();

	const profile = await getProfile(identity.getPrincipal().toText());
	const role = profile?.role;

	if (role !== UserRole.ADMIN && role !== UserRole.CREATOR) {
		throw new Error('Unauthorized: only admins or creators can create markets');
	}

	const seriesId = await addSeries({
		identity,
		params: {
			underlying: title, // Using title as underlying for now
			title,
			description,
			expiry: expiryDate,
			// Defaulting to ICP for settlement
			settlement_asset: { Icp: null },
			strike: STRIKE,
			payoff_type: PAYOFF_TYPE,
			oracle_source: VICI_ORACLE_V1
		}
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

	return seriesList.map(mapMarketData);
};

export const getMarket = async (marketId: MarketId): Promise<Market | undefined> => {
	const identity = await getIdentityOrAnonymous();

	const s = await getSeries({ identity, seriesId: marketId });

	if (isNullish(s)) {
		return;
	}

	return mapMarketData(s);
};

export const getRushQueue = async (): Promise<Market[]> => {
	const markets = await getMarkets();
	// For now, all open markets are eligible for Rush Mode
	return markets.sort((a, b) => Number(b.id) - Number(a.id));
};
