import { getPositions as getPositionsApi, submitMatchedTrade } from '$lib/api/clearing.api';
import { getIdentity, safeGetIdentityOnce } from '$lib/services/identity.services';
import type { MarketId } from '$lib/types/market';
import type { Position, PositionType } from '$lib/types/position';
import { mapPositionData } from '$lib/utils/position.utils';
import { isNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';

export const placePrediction = async ({
	marketId,
	type,
	amount
}: {
	marketId: MarketId;
	type: PositionType;
	amount: bigint;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	const userPrincipal = identity.getPrincipal();

	// For Vici Binary markets:
	// YES prediction at 0.5 probability means price is 50/100
	// TODO: implement method to fetch price
	const price = 37n;

	// Submit Matched Trade to Clearing Canister
	// If YES: User is Buyer, LP is Seller
	// If NO: LP is Buyer, User is Seller
	const isYes = type === 'YES';

	// TODO: implement proper LP selection logic instead of hardcoding MOCK_LP_PRINCIPAL
	const buyer = isYes ? userPrincipal : Principal.fromText('2vxsx-fae');
	const seller = isYes ? Principal.fromText('2vxsx-fae') : userPrincipal;

	await submitMatchedTrade({
		identity,
		params: {
			series_id: marketId,
			trade_id: crypto.randomUUID(),
			buyer,
			seller,
			qty: amount,
			price
		}
	});

	// TODO: trigger UI refresh and update metadata volumes
};

export const getPositions = async (): Promise<Position[]> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return [];
	}

	const positions = await getPositionsApi({ identity });

	return positions.map(mapPositionData);
};
