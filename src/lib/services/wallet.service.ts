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

export const getBalances = async (): Promise<WalletBalance> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return { icp: ZERO, ckUsdc: ZERO };
	}

	try {
		const account = await getMarginAccount({
			identity,
			// TODO: revisit
			params: { refresh: toNullable(true) }
		});

		const { icp, ckUsdc } = account.balances.reduce(
			(acc, [asset, balance]) => {
				if ('Icrc' in asset) {
					const principalText = asset.Icrc.toText();

					if (principalText === ICP_LEDGER_CANISTER_ID) {
						return { ...acc, icp: balance };
					}

					if (principalText === CKUSDC_LEDGER_CANISTER_ID) {
						return { ...acc, ckUsdc: balance };
					}
				}

				return acc;
			},
			{ icp: ZERO, ckUsdc: ZERO }
		);

		return { icp, ckUsdc };
	} catch (e: unknown) {
		console.error('Failed to get balances from canister', e);

		return { icp: ZERO, ckUsdc: ZERO };
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
