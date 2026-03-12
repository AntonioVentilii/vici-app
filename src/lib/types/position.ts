import type { MarketId } from '$lib/types/market';
import type { Principal } from '@icp-sdk/core/principal';

export type PositionType = 'YES' | 'NO' | string;

export interface Position {
	marketId: MarketId;
	user: Principal;
	outcomeId: string; // 'YES', 'NO', or categorical ID
	netQty: bigint;
	lockedCollateral: bigint;
}
