import type { MarketId } from '$lib/types/market';
import type { Principal } from '@icp-sdk/core/principal';

export type PositionType = 'YES' | 'NO';

export interface Position {
	marketId: MarketId;
	user: Principal;
	yesAmount: bigint;
	noAmount: bigint;
}
