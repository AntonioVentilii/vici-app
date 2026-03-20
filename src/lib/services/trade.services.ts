import type { ClearingDid } from '$declarations';
import {
	getPositions as getPositionsApi,
	getTradeHistory as getTradeHistoryApi,
	mintCompleteSet as mintCompleteSetApi,
	redeemCompleteSet as redeemCompleteSetApi
} from '$lib/api/clearing.api';
import { safeGetIdentityOnce } from '$lib/services/identity.services';

export const getPosition = async (seriesId: string): Promise<ClearingDid.Position | undefined> => {
	const identity = await safeGetIdentityOnce();

	const positions = await getPositionsApi({
		identity
	});

	return positions.find((p) => p.series_id === seriesId);
};

export const getUserTradeHistory = async (): Promise<ClearingDid.Event[]> => {
	const identity = await safeGetIdentityOnce();

	return await getTradeHistoryApi({
		identity
	});
};

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
