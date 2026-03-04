/* eslint-disable require-await */

import { getMarginAccount } from '$lib/api/clearing.api';
import { ZERO } from '$lib/constants/app.constants';
import {
	CKUSDC_LEDGER_CANISTER_ID,
	ICP_LEDGER_CANISTER_ID
} from '$lib/constants/canisters.constants';
import { getIdentity } from '$lib/services/identity.services';
import type { Transaction, WalletBalance } from '$lib/types/wallet';
import { isNullish, toNullable } from '@dfinity/utils';

import { balance as getLedgerBalance } from '$lib/api/icrc-ledger.api';

export const getBalances = async (): Promise<WalletBalance> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return { icp: ZERO, ckUsdc: ZERO, collateral: ZERO };
	}

	const principal = identity.getPrincipal();

	try {
		// 1. Fetch Ledger Balances
		const [icpLedger, ckUsdcLedger] = await Promise.all([
			getLedgerBalance({
				identity,
				ledgerCanisterId: ICP_LEDGER_CANISTER_ID,
				account: { owner: principal }
			}),
			getLedgerBalance({
				identity,
				ledgerCanisterId: CKUSDC_LEDGER_CANISTER_ID,
				account: { owner: principal }
			}).catch(() => ZERO) // Optional: handle missing/unsupported ledger
		]);

		// 2. Fetch Collateral Balances
		const account = await getMarginAccount({
			identity,
			params: { refresh: toNullable(true) }
		});

		const collateral = account.balances.reduce((acc, [_, balance]) => acc + balance, ZERO);

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

export const sendICP = (): Promise<void> => {
	throw Error('sendICP: Standard IC Transfer not implemented yet');
};

export const sendCkUSDC = async (): Promise<void> => {
	throw Error('sendCkUSDC: Standard IC Transfer not implemented yet');
};

export const getTransactions = async (): Promise<Transaction[]> => {
	throw Error('getTransactions: Transaction history not implemented yet');
};
