import { getPositions as getPositionsApi } from '$lib/api/clearing.api';
import { getIdentity } from '$lib/services/identity.services';
import { getMarkets } from '$lib/services/market.services';
import type { MarketId } from '$lib/types/market';
import type { Position } from '$lib/types/position';
import { filterByMarketIds } from '$lib/utils/balance-domain.utils';
import { mapPositionData } from '$lib/utils/position.utils';
import { isNullish } from '@dfinity/utils';

export const getPositions = async (): Promise<Position[]> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return [];
	}

	const [positions, markets] = await Promise.all([getPositionsApi({ identity }), getMarkets()]);

	const marketIds = new Set(markets.map((m) => m.id));

	return filterByMarketIds({ items: positions, marketIds }).map(mapPositionData);
};

export const getPositionsForMarket = async (targetSeriesId: MarketId): Promise<Position[]> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return [];
	}

	const positions = await getPositionsApi({ identity });

	return positions.filter((p) => p.series_id === targetSeriesId).map(mapPositionData);
};
