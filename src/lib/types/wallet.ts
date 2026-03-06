import type { MarketId } from '$lib/types/market';
import type { Token } from '$lib/types/token';
import type { PrincipalText } from '@dfinity/zod-schemas';

export type TransactionType = 'Trade' | 'Send' | 'Receive' | 'Burn' | 'Mint' | 'Approve';

export interface WalletBalance {
	balances: Record<string, bigint>; // ledgerCanisterId -> balance
	collateral: Record<string, bigint>; // ledgerCanisterId -> balance
}

export type TransactionId = string;

export interface Transaction {
	id: TransactionId;
	user: PrincipalText;
	timestamp: bigint;
	type: TransactionType;
	marketId?: MarketId;
	amount: bigint;
	token: Token;
	counterparty?: PrincipalText;
	approveSpender?: PrincipalText;
}
