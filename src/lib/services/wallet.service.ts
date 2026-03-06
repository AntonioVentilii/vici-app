import { getMarginAccount } from '$lib/api/clearing.api';
import { getTransactions as getIcpTransactionsApi } from '$lib/api/icp-index.api';
import { getTransactions as getIcrcTransactionsApi } from '$lib/api/icrc-index-ng.api';
import { balance as getLedgerBalance } from '$lib/api/icrc-ledger.api';
import { ZERO } from '$lib/constants/app.constants';
import {
	CKUSDC_INDEX_CANISTER_ID,
	CKUSDC_LEDGER_CANISTER_ID,
	ICP_INDEX_CANISTER_ID,
	ICP_LEDGER_CANISTER_ID
} from '$lib/constants/canisters.constants';
import { CKUSDC_TOKEN, ICP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import { getIdentity } from '$lib/services/identity.services';
import type { Transaction, WalletBalance } from '$lib/types/wallet';
import {
	getIcrcAccount,
	mapIcpTransaction,
	mapIcrcTransaction,
	mapTransactionIcpToSelf,
	mapTransactionIcrcToSelf
} from '$lib/utils/transactions.utils';
import { isNullish, toNullable } from '@dfinity/utils';

export const getBalances = async (): Promise<WalletBalance> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return { icp: ZERO, ckUsdc: ZERO, collateral: ZERO };
	}

	const principal = identity.getPrincipal();

	try {
		const account = getIcrcAccount(principal);

		// 1. Fetch Ledger Balances
		const [icpLedger, ckUsdcLedger] = await Promise.all([
			getLedgerBalance({
				identity,
				ledgerCanisterId: ICP_LEDGER_CANISTER_ID,
				account
			}),
			getLedgerBalance({
				identity,
				ledgerCanisterId: CKUSDC_LEDGER_CANISTER_ID,
				account
			})
		]);

		// 2. Fetch Collateral Balances
		const margin = await getMarginAccount({
			identity,
			params: { refresh: toNullable(true) }
		});

		const collateral = margin.balances.reduce((acc, [_, balance]) => acc + balance, ZERO);

		return {
			icp: icpLedger,
			ckUsdc: ckUsdcLedger,
			collateral
		};
	} catch (e: unknown) {
		console.error('Failed to get balances', e);

		return { icp: ZERO, ckUsdc: ZERO, collateral: ZERO };
	}
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
