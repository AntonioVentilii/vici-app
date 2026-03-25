import type { ClearingDid } from '$declarations';
import {
	depositCollateral as depositCollateralApi,
	getAccountState as getAccountStateApi,
	listCollateralAssets as listCollateralAssetsApi,
	registerIcrcAsset as registerIcrcAssetApi,
	withdrawCollateral as withdrawCollateralApi
} from '$lib/api/clearing.api';
import { approve, transactionFee } from '$lib/api/icrc-ledger.api';
import { CLEARING_CANISTER_ID } from '$lib/constants/canisters.constants';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { refreshAllBalances } from '$lib/utils/refresh.utils';
import { resolveClearingAssetId } from '$lib/utils/tokens.utils';
import { getIcrcAccount } from '$lib/utils/transactions.utils';
import { isNullish, nowInBigIntNanoSeconds, toNullable } from '@dfinity/utils';
import { getIdentityOnce } from '@junobuild/core';

const makeOperationId = ({ prefix, hint }: { prefix: string; hint?: bigint }): string => {
	// Idempotency keys are user-provided strings on the clearing canister side.
	// Using `Date.now()` alone can collide under rapid retries/double-clicks (same ms),
	// which may lead to surprising "amount mismatch" UX.
	const uuid =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `${Date.now()}_${Math.random().toString(16).slice(2)}`;

	return isNullish(hint) ? `${prefix}_${uuid}` : `${prefix}_${hint.toString()}_${uuid}`;
};

/** ICRC approve + clearing deposit for the current balance domain; refreshes balances on success. */
export const depositCollateral = async ({
	assetPrincipal,
	amount,
	domain
}: {
	assetPrincipal: string;
	amount: bigint;
	domain: ClearingDid.BalanceDomain;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	const ledgerFee = await transactionFee({ identity, ledgerCanisterId: assetPrincipal });
	// ICRC-2: allowance must cover `amount + fee` for `icrc2_transfer_from`
	const approvalAmount = amount + ledgerFee;

	// 1. Approve clearing canister to spend tokens
	await approve({
		identity,
		ledgerCanisterId: assetPrincipal,
		amount: approvalAmount,
		spender: getIcrcAccount(CLEARING_CANISTER_ID),
		expiresAt: nowInBigIntNanoSeconds() + 60n * 1_000_000_000n // 1 minute
	});

	const asset_id = resolveClearingAssetId(assetPrincipal);

	// 2. Deposit collateral
	await depositCollateralApi({
		identity,
		params: {
			deposit_id: makeOperationId({ prefix: 'DEPOSIT', hint: amount }),
			domain: toNullable(domain),
			asset_id,
			amount
		}
	});

	refreshAllBalances();
};

/** Withdraws collateral from clearing to the user for the given ledger asset. */
export const withdrawCollateral = async ({
	assetPrincipal,
	amount,
	domain
}: {
	assetPrincipal: string;
	amount: bigint;
	domain: ClearingDid.BalanceDomain;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	const asset_id = resolveClearingAssetId(assetPrincipal);

	await withdrawCollateralApi({
		identity,
		params: {
			withdrawal_id: makeOperationId({ prefix: 'WITHDRAW', hint: amount }),
			domain: toNullable(domain),
			asset_id,
			amount
		}
	});

	refreshAllBalances();
};

/** Fetches clearing account state (balances per domain) for the signed-in user. */
export const getAccountState = async (
	domain: ClearingDid.BalanceDomain
): Promise<ClearingDid.AccountStateResponse> => {
	const identity = await safeGetIdentityOnce();

	return await getAccountStateApi({
		identity,
		params: { refresh: toNullable(true), domain: toNullable(domain) }
	});
};

/** Lists collateral assets configured on clearing (empty if anonymous). */
export const getCollateralAssets = async (): Promise<ClearingDid.CollateralAssetInfo[]> => {
	const identity = await getIdentityOnce();

	if (isNullish(identity)) {
		return [];
	}

	return await listCollateralAssetsApi({ identity });
};

/** Registers an ICRC ledger as a collateral asset on clearing (admin-style operation). */
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
