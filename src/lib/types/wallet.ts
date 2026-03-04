import type { MarketId } from '$lib/types/market';
import type { PrincipalText } from '@dfinity/zod-schemas';

export type TransactionType = 'Trade' | 'Send' | 'Receive';

export interface WalletBalance {
	icp: bigint;
	ckUsdc: bigint;
	collateral: bigint;
}

export type TransactionId = string;

export interface Transaction {
	id: TransactionId;
	user: PrincipalText;
	timestamp: bigint;
	type: TransactionType;
	marketId?: MarketId;
	amount: bigint;
	token: 'ICP' | 'ckUSDC' | 'USDC';
	counterparty?: PrincipalText;
}
