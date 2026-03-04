import type { ClearingDid } from '$declarations';
import {
	getPosition as getPositionApi,
	submitMatchedTrade as submitMatchedTradeApi
} from '$lib/api/clearing.api';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { Principal } from '@icp-sdk/core/principal';

export const submitTrade = async ({
	seriesId,
	buyer,
	seller,
	qty,
	price
}: {
	seriesId: string;
	buyer: string;
	seller: string;
	qty: bigint;
	price: bigint;
}): Promise<boolean> => {
	const identity = await safeGetIdentityOnce();

	return await submitMatchedTradeApi({
		identity,
		params: {
			trade_id: `TRADE_${Date.now()}`,
			series_id: seriesId,
			buyer: Principal.fromText(buyer),
			seller: Principal.fromText(seller),
			qty,
			price
		}
	});
};

export const getPosition = async (seriesId: string): Promise<ClearingDid.Position | undefined> => {
	const identity = await safeGetIdentityOnce();

	return await getPositionApi({
		identity,
		params: { series_id: seriesId }
	});
};
