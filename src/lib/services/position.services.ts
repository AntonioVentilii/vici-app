import { getPositions as getPositionsApi, submitMatchedTrade } from '$lib/api/clearing.api';
import { ZERO } from '$lib/constants/app.constants';
import { getIdentity, safeGetIdentityOnce } from '$lib/services/identity.services';
import type { Market, MarketId } from '$lib/types/market';
import type { Position, PositionType } from '$lib/types/position';
import { mapPositionData } from '$lib/utils/position.utils';
import { isNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';

export const placePrediction = async ({
	market,
	type,
	amount
}: {
	market: Market;
	type: PositionType;
	amount: bigint;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	const userPrincipal = identity.getPrincipal();

	// Clearing prices are e8. Probability is 0..1
	const yesPrice = BigInt(Math.floor(market.yesProbability * 100_000_000));

	// TODO: implement proper LP selection logic
	const LP_PRINCIPAL = Principal.fromText('2vxsx-fae');

	const isYes = type === 'YES';

	// qty = amount_in_e8 * 1e8 / cost_per_unit
	// For YES, cost_per_unit = yesPrice
	// For NO, cost_per_unit = (1e8 - yesPrice)
	const pricePerUnit = isYes ? yesPrice : 100_000_000n - yesPrice;

	if (pricePerUnit === ZERO) {
		throw new Error('Invalid price: outcome probability is 0');
	}

	const qty = (amount * 100_000_000n) / pricePerUnit;

	// Submit Matched Trade
	await submitMatchedTrade({
		identity,
		params: {
			series_id: market.id,
			trade_id: `TRADE_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
			buyer: isYes ? userPrincipal : LP_PRINCIPAL,
			seller: isYes ? LP_PRINCIPAL : userPrincipal,
			qty,
			price: yesPrice
		}
	});
};

export const getPositions = async (): Promise<Position[]> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return [];
	}

	const positions = await getPositionsApi({ identity });

	return positions.map(mapPositionData);
};

export const getPositionForMarket = async (
	targetSeriesId: MarketId
): Promise<Position | undefined> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return;
	}

	const positions = await getPositionsApi({ identity });

	const marketTuple = positions.find(([seriesId]) => seriesId === targetSeriesId);

	return marketTuple ? mapPositionData(marketTuple) : undefined;
};
