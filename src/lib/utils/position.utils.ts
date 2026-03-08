import type { ClearingDid } from '$declarations';
import { ZERO } from '$lib/constants/app.constants';
import type { Position } from '$lib/types/position';
import { parseMarketId } from '$lib/validation/market.validation';

export const mapPositionData = ([id, position]: [string, ClearingDid.Position]): Position => {
	const { user, net_qty: qty, locked_collateral: locked } = position;

	return {
		marketId: parseMarketId(id),
		user,
		// In Clearing canister, net_qty is:
		// Positive for Long (YES)
		// Negative for Short (NO)
		yesAmount: qty > ZERO ? qty : ZERO,
		noAmount: qty < ZERO ? -qty : ZERO,
		lockedCollateral: locked
	};
};
