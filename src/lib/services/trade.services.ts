import type { ClearingDid } from '$declarations';
import {
	getPositions as getPositionsApi,
	getTradeHistory as getTradeHistoryApi
} from '$lib/api/clearing.api';
import { safeGetIdentityOnce } from '$lib/services/identity.services';

export const getPosition = async (seriesId: string): Promise<ClearingDid.Position | undefined> => {
	const identity = await safeGetIdentityOnce();

	const positions = await getPositionsApi({
		identity
	});

	return positions.find(([id]) => id === seriesId)?.[1];
};

export const getUserTradeHistory = async (): Promise<ClearingDid.Event[]> => {
	const identity = await safeGetIdentityOnce();

	return await getTradeHistoryApi({
		identity
	});
};
