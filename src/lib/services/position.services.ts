import { getPositions as getPositionsApi } from '$lib/api/clearing.api';
import { getIdentity } from '$lib/services/identity.services';
import type { MarketId } from '$lib/types/market';
import type { Position } from '$lib/types/position';
import { mapPositionData } from '$lib/utils/position.utils';
import { isNullish } from '@dfinity/utils';

export const getPositions = async (): Promise<Position[]> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return [];
	}

	const positions = await getPositionsApi({ identity });

	return positions.map(mapPositionData);
};

export const getPositionsForMarket = async (targetSeriesId: MarketId): Promise<Position[]> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return [];
	}

	const positions = await getPositionsApi({ identity });

	return positions.filter((p) => p.series_id === targetSeriesId).map(mapPositionData);
};
