import type { ClearingDid } from '$declarations';
import type { MarketId } from '$lib/types/market';
import type { Token, TokenId } from '$lib/types/token';
import type { PrincipalText } from '@dfinity/zod-schemas';

export type TransactionType = 'Trade' | 'Send' | 'Receive' | 'Burn' | 'Mint' | 'Approve';

export interface WalletBalance {
	balances: Record<TokenId, bigint>;
	collateral: Record<TokenId, bigint>;
	accountState?: ClearingDid.AccountStateResponse;
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
