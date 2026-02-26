import type { ClearingDid } from '$declarations';
import { ZERO } from '$lib/constants/app.constants';
import type { Position } from '$lib/types/position';
import { parseMarketId } from '$lib/validation/market.validation';

export const mapPositionData = ([id, { user, net_qty: qty }]: [
	string,
	ClearingDid.Position
]): Position => ({
	marketId: parseMarketId(id),
	user,
	// In Clearing canister, net_qty is:
	// Positive for Long (YES)
	// Negative for Short (NO)
	yesAmount: qty > ZERO ? qty : ZERO,
	noAmount: qty < ZERO ? -qty : ZERO
});
