import type { ClearingDid } from '$declarations';
import { getAccountState } from '$lib/api/clearing.api';
import { getTransactions as getIcpTransactionsApi } from '$lib/api/icp-index.api';
import { getTransactions as getIcrcTransactionsApi } from '$lib/api/icrc-index-ng.api';
import { balance as getLedgerBalance } from '$lib/api/icrc-ledger.api';
import { DEFAULT_BALANCE_DOMAIN, ZERO } from '$lib/constants/app.constants';
import {
	CKUSDC_INDEX_CANISTER_ID,
	ICP_INDEX_CANISTER_ID
} from '$lib/constants/canisters.constants';
import {
	CKUSDC_TOKEN,
	ICP_TOKEN,
	SUPPORTED_TOKENS
} from '$lib/constants/tokens/tokens.ic.constants';
import { getIdentity } from '$lib/services/identity.services';
import type { TokenId } from '$lib/types/token';
import type { Transaction, WalletBalance } from '$lib/types/wallet';
import {
	getIcrcAccount,
	mapIcpTransaction,
	mapIcrcTransaction,
	mapTransactionIcpToSelf,
	mapTransactionIcrcToSelf
} from '$lib/utils/transactions.utils';
import { isNullish, nonNullish, toNullable } from '@dfinity/utils';

export const getLedgerBalances = async (): Promise<Record<string, bigint>> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return {};
	}

	const principal = identity.getPrincipal();

	try {
		const account = getIcrcAccount(principal);

		// 1. Fetch Ledger Balances for supported tokens
		const balancePromises = SUPPORTED_TOKENS.map((token) =>
			getLedgerBalance({
				identity,
				ledgerCanisterId: token.ledgerCanisterId,
				account
			})
		);

		const balanceResults = await Promise.all(balancePromises);

		const balances: Record<TokenId, bigint> = {};

		SUPPORTED_TOKENS.forEach((token, index) => {
			balances[token.id] = balanceResults[index];
		});

		return balances;
	} catch (e: unknown) {
		console.error('Failed to get ledger balances', e);

		return {};
	}
};

export const getCollateralBalances = async (): Promise<
	ClearingDid.AccountStateResponse | undefined
> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return;
	}

	try {
		// 2. Fetch Collateral Balances
		return await getAccountState({
			identity,
			params: { refresh: toNullable(true), domain: toNullable(DEFAULT_BALANCE_DOMAIN) }
		});
	} catch (e: unknown) {
		console.error('Failed to get collateral balances', e);
	}
};

export const getBalances = async (): Promise<WalletBalance> => {
	const [balances, accountState] = await Promise.all([
		getLedgerBalances(),
		getCollateralBalances()
	]);

	const collateral: Record<TokenId, bigint> = {};

	if (nonNullish(accountState)) {
		// Aggregate balances across all domains
		accountState.state.balances.forEach(([, domainBalances]) => {
			domainBalances.forEach(([assetId, balance]) => {
				const token = SUPPORTED_TOKENS.find((t) => t.symbol.toLowerCase() === assetId);

				if (nonNullish(token)) {
					collateral[token.id] = (collateral[token.id] ?? ZERO) + balance;
				}
			});
		});
	}

	return {
		balances,
		collateral,
		accountState
	};
};

export const getTransactions = async (): Promise<Transaction[]> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return [];
	}

	const principal = identity.getPrincipal();

	try {
		// 1. Fetch Index Transactions
		const [icpTransactions, ckUsdcTransactions] = await Promise.all([
			await getIcpTransactionsApi({
				identity,
				principal,
				indexCanisterId: ICP_INDEX_CANISTER_ID
			}),
			await getIcrcTransactionsApi({
				identity,
				principal,
				indexCanisterId: CKUSDC_INDEX_CANISTER_ID
			})
		]);

		const icpNormalized: Transaction[] = icpTransactions.transactions
			.flatMap(mapTransactionIcpToSelf)
			.map((transaction) => mapIcpTransaction({ transaction, token: ICP_TOKEN, identity }));

		const ckUsdcNormalized: Transaction[] = ckUsdcTransactions.transactions
			.flatMap(mapTransactionIcrcToSelf)
			.map((transaction) => mapIcrcTransaction({ transaction, token: CKUSDC_TOKEN, identity }));

		return [...icpNormalized, ...ckUsdcNormalized].sort(
			(a, b) => Number(b.timestamp) - Number(a.timestamp)
		);
	} catch (e: unknown) {
		console.error('Failed to get transactions', e);

		return [];
	}
};
