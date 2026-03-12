import type { ClearingDid } from '$declarations';
import { ZERO } from '$lib/constants/app.constants';
import type { Position } from '$lib/types/position';
import { parseMarketId } from '$lib/validation/market.validation';

export const mapPositionData = (position: ClearingDid.Position): Position => {
	const { user, series_id: id, net_qty: qty, reserved_margin_usd: locked } = position;

	return {
		marketId: parseMarketId(id),
		user,
		outcomeId: position.outcome_id[0] ?? (qty > ZERO ? 'YES' : 'NO'),
		netQty: qty,
		lockedCollateral: locked
	};
};
