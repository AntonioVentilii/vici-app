import type { ClearingDid } from '$declarations';
import {
	depositCollateral as depositCollateralApi,
	getAccountState as getAccountStateApi,
	listCollateralAssets as listCollateralAssetsApi,
	registerIcrcAsset as registerIcrcAssetApi,
	withdrawCollateral as withdrawCollateralApi
} from '$lib/api/clearing.api';
import { approve } from '$lib/api/icrc-ledger.api';
import { CLEARING_CANISTER_ID } from '$lib/constants/canisters.constants';
import { balanceDomain } from '$lib/derived/balance-domain.derived';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { refreshAllBalances } from '$lib/utils/refresh.utils';
import { getAssetIdByLedgerId } from '$lib/utils/tokens.utils';
import { getIcrcAccount } from '$lib/utils/transactions.utils';
import { isNullish, nowInBigIntNanoSeconds, toNullable } from '@dfinity/utils';
import { getIdentityOnce } from '@junobuild/core';
import { get } from 'svelte/store';

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

	const asset_id = getAssetIdByLedgerId(assetPrincipal);

	// 2. Deposit collateral
	await depositCollateralApi({
		identity,
		params: {
			deposit_id: `DEPOSIT_${Date.now()}`,
			domain: toNullable(get(balanceDomain)),
			asset_id,
			amount
		}
	});

	refreshAllBalances();
};

export const withdrawCollateral = async ({
	assetPrincipal,
	amount
}: {
	assetPrincipal: string;
	amount: bigint;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	const asset_id = getAssetIdByLedgerId(assetPrincipal);

	await withdrawCollateralApi({
		identity,
		params: {
			withdrawal_id: `WITHDRAW_${Date.now()}`,
			domain: toNullable(get(balanceDomain)),
			asset_id,
			amount
		}
	});

	refreshAllBalances();
};

export const getAccountState = async (): Promise<ClearingDid.AccountStateResponse> => {
	const identity = await safeGetIdentityOnce();

	return await getAccountStateApi({
		identity,
		params: { refresh: toNullable(true), domain: toNullable(get(balanceDomain)) }
	});
};

export const getCollateralAssets = async (): Promise<ClearingDid.CollateralAssetInfo[]> => {
	const identity = await getIdentityOnce();

	if (isNullish(identity)) {
		return [];
	}

	return await listCollateralAssetsApi({ identity });
};

export const registerIcrcAsset = async (
	params: ClearingDid.RegisterIcrcAssetParams
): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	await registerIcrcAssetApi({
		identity,
		params
	});

	refreshAllBalances();
};
