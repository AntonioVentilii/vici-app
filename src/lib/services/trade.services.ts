import type { ClearingDid } from '$declarations';
import {
	getPosition as getPositionApi,
	submitMatchedTrade as submitMatchedTradeApi
} from '$lib/api/clearing.api';
import { logActivity } from '$lib/services/activity.services';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { ActivityType } from '$lib/types/social';
import { toNullable } from '@dfinity/utils';
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

	const success = await submitMatchedTradeApi({
		identity,
		params: {
			trade_id: `TRADE_${Date.now()}`,
			series_id: seriesId,
			buyer: Principal.fromText(buyer),
			seller: Principal.fromText(seller),
			qty,
			price,
			buyer_unblock_amount: toNullable(),
			seller_unblock_amount: toNullable()
		}
	});

	if (success) {
		await logActivity({
			type: ActivityType.TRADE,
			user: identity.getPrincipal().toText(),
			marketId: seriesId,
			title: `New trade executed`,
			details: `Traded ${qty} at ${price}`
		});
	}

	return success;
};

export const getPosition = async (seriesId: string): Promise<ClearingDid.Position | undefined> => {
	const identity = await safeGetIdentityOnce();

	return await getPositionApi({
		identity,
		params: { series_id: seriesId }
	});
};
