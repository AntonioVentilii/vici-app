import type { MarketId } from '$lib/types/market';
import type { PrincipalText } from '@dfinity/zod-schemas';

export type TransactionType = 'Trade' | 'Send' | 'Receive';

export interface WalletBalance {
	icp: bigint;
	ckUsdc: bigint;
}

export interface Transaction {
	// TODO: define transaction ID type
	id: string;
	user: PrincipalText;
	timestamp: bigint;
	type: TransactionType;
	marketId?: MarketId;
	amount: bigint;
	// TODO: defined type
	token: 'ICP' | 'ckUSDC';
	counterparty?: PrincipalText;
}
