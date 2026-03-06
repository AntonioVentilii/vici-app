import type { ClearingDid } from '$declarations';
import {
	depositCollateral as depositCollateralApi,
	getMarginAccount as getMarginAccountApi,
	withdrawCollateral as withdrawCollateralApi
} from '$lib/api/clearing.api';
import { approve } from '$lib/api/icrc-ledger.api';
import { CLEARING_CANISTER_ID } from '$lib/constants/canisters.constants';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { emitRefreshBalance } from '$lib/utils/refresh.utils';
import { getIcrcAccount } from '$lib/utils/transactions.utils';
import { nowInBigIntNanoSeconds } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';

export const depositCollateral = async ({
	assetPrincipal,
	amount
}: {
	assetPrincipal: string;
	amount: bigint;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	// 1. Approve clearing canister to spend tokens
	await approve({
		identity,
		ledgerCanisterId: assetPrincipal,
		amount: amount + 10_000n, // Plus fee
		spender: getIcrcAccount(CLEARING_CANISTER_ID),
		expiresAt: nowInBigIntNanoSeconds() + 60n * 1_000_000_000n // 1 minute
	});

	// 2. Deposit collateral
	await depositCollateralApi({
		identity,
		params: {
			deposit_id: `DEPOSIT_${Date.now()}`,
			asset: { Icrc: Principal.fromText(assetPrincipal) },
			amount
		}
	});

	emitRefreshBalance();
};

export const withdrawCollateral = async ({
	assetPrincipal,
	amount
}: {
	assetPrincipal: string;
	amount: bigint;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	await withdrawCollateralApi({
		identity,
		params: {
			withdrawal_id: `WITHDRAW_${Date.now()}`,
			asset: { Icrc: Principal.fromText(assetPrincipal) },
			amount
		}
	});

	emitRefreshBalance();
};

export const getMarginAccount = async (): Promise<ClearingDid.MarginAccount> => {
	const identity = await safeGetIdentityOnce();

	return await getMarginAccountApi({
		identity,
		params: { refresh: [true] }
	});
};
