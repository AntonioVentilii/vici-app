import type { MarketId } from '$lib/types/market';
import type { Principal } from '@icp-sdk/core/principal';

export type TransactionType = 'Trade' | 'Send' | 'Receive';

export interface WalletBalance {
	icp: bigint;
	ckUsdc: bigint;
}

export interface Transaction {
	// TODO: define transaction ID type
	id: string;
	user: Principal;
	timestamp: bigint;
	type: TransactionType;
	marketId?: MarketId;
	amount: bigint;
	// TODO: defined type
	token: 'ICP' | 'ckUSDC';
	counterparty?: Principal;
}
