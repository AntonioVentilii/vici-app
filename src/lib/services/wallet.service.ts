import type { ClearingDid } from '$declarations';
import { getAccountState } from '$lib/api/clearing.api';
import { getTransactions as getIcpTransactionsApi } from '$lib/api/icp-index.api';
import { getTransactions as getIcrcTransactionsApi } from '$lib/api/icrc-index-ng.api';
import { balance as getLedgerBalance } from '$lib/api/icrc-ledger.api';
import { ZERO } from '$lib/constants/app.constants';
import {
	CKUSDC_INDEX_CANISTER_ID,
	ICP_INDEX_CANISTER_ID,
	VXP_INDEX_CANISTER_ID
} from '$lib/constants/canisters.constants';
import {
	CKUSDC_TOKEN,
	ICP_TOKEN,
	SUPPORTED_TOKENS,
	VXP_TOKEN
} from '$lib/constants/tokens/tokens.ic.constants';
import { balanceDomain } from '$lib/derived/balance-domain.derived';
import { getCollateralAssets } from '$lib/services/collateral.services';
import { getIdentity } from '$lib/services/identity.services';
import type { TokenId } from '$lib/types/token';
import type { Transaction, WalletBalance } from '$lib/types/wallet';
import { findSupportedTokenForClearingAssetId } from '$lib/utils/asset-ref.utils';
import { compareBalanceDomains } from '$lib/utils/balance-domain.utils';
import {
	getIcrcAccount,
	mapIcpTransaction,
	mapIcrcTransaction,
	mapTransactionIcpToSelf,
	mapTransactionIcrcToSelf
} from '$lib/utils/transactions.utils';
import { isNullish, nonNullish, toNullable } from '@dfinity/utils';
import { get } from 'svelte/store';

/** On-ledger balances for each supported token id (empty if not signed in). */
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

/** Clearing account state for `domain` (defaults to current UI balance domain). */
export const getCollateralBalances = async (
	domain: ClearingDid.BalanceDomain = get(balanceDomain)
): Promise<ClearingDid.AccountStateResponse | undefined> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return;
	}

	try {
		// 2. Fetch Collateral Balances
		return await getAccountState({
			identity,
			params: { refresh: toNullable(true), domain: toNullable(domain) }
		});
	} catch (e: unknown) {
		console.error('Failed to get collateral balances', e);
	}
};

/** Combined ledger balances and per-token clearing collateral for the given domain. */
export const getBalances = async (
	domain: ClearingDid.BalanceDomain = get(balanceDomain)
): Promise<WalletBalance> => {
	const [balances, accountState, collateralInfos] = await Promise.all([
		getLedgerBalances(),
		getCollateralBalances(domain),
		getCollateralAssets()
	]);

	const collateral: Record<TokenId, bigint> = {};

	if (nonNullish(accountState)) {
		const targetDomainBalances = accountState.state.balances.find(([d]) =>
			compareBalanceDomains(d, domain)
		);

		if (nonNullish(targetDomainBalances)) {
			const [, domainBalances] = targetDomainBalances;
			domainBalances.forEach(([assetId, balance]) => {
				const token = findSupportedTokenForClearingAssetId({
					assetId,
					collateralInfos,
					supportedTokens: SUPPORTED_TOKENS
				});

				if (nonNullish(token)) {
					collateral[token.id] = (collateral[token.id] ?? ZERO) + balance;
				}
			});
		}
	}

	return {
		balances,
		collateral,
		accountState
	};
};

/** Recent ICP, ckUSDC, and VXP index transactions normalized and merged, newest first. */
export const getTransactions = async (): Promise<Transaction[]> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return [];
	}

	const principal = identity.getPrincipal();

	try {
		const [icpTransactions, ckUsdcTransactions, vxpTransactions] = await Promise.all([
			getIcpTransactionsApi({
				identity,
				principal,
				indexCanisterId: ICP_INDEX_CANISTER_ID
			}),
			getIcrcTransactionsApi({
				identity,
				principal,
				indexCanisterId: CKUSDC_INDEX_CANISTER_ID
			}),
			getIcrcTransactionsApi({
				identity,
				principal,
				indexCanisterId: VXP_INDEX_CANISTER_ID
			})
		]);

		const icpNormalized: Transaction[] = icpTransactions.transactions
			.flatMap(mapTransactionIcpToSelf)
			.map((transaction) => mapIcpTransaction({ transaction, token: ICP_TOKEN, identity }));

		const ckUsdcNormalized: Transaction[] = ckUsdcTransactions.transactions
			.flatMap(mapTransactionIcrcToSelf)
			.map((transaction) => mapIcrcTransaction({ transaction, token: CKUSDC_TOKEN, identity }));

		const vxpNormalized: Transaction[] = vxpTransactions.transactions
			.flatMap(mapTransactionIcrcToSelf)
			.map((transaction) => mapIcrcTransaction({ transaction, token: VXP_TOKEN, identity }));

		return [...icpNormalized, ...ckUsdcNormalized, ...vxpNormalized].sort(
			(a, b) => Number(b.timestamp) - Number(a.timestamp)
		);
	} catch (e: unknown) {
		console.error('Failed to get transactions', e);

		return [];
	}
};
