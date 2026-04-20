import type { ClearingDid } from '$declarations';
import {
	depositCollateral as depositCollateralApi,
	getAccountState as getAccountStateApi,
	getAccountStateQuery as getAccountStateQueryApi,
	listCollateralAssets as listCollateralAssetsApi,
	registerIcrcAsset as registerIcrcAssetApi,
	withdrawCollateral as withdrawCollateralApi
} from '$lib/api/clearing.api';
import { approve, transactionFee } from '$lib/api/icrc-ledger.api';
import { CLEARING_CANISTER_ID } from '$lib/constants/canisters.constants';
import { getIdentity, safeGetIdentityOnce } from '$lib/services/identity.services';
import { loadWithCertification } from '$lib/services/query-update.services';
import { refreshAllBalances } from '$lib/utils/refresh.utils';
import { resolveClearingAssetId } from '$lib/utils/tokens.utils';
import { getIcrcAccount } from '$lib/utils/transactions.utils';
import { isNullish, nowInBigIntNanoSeconds, toNullable } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';
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

/**
 * ICRC approve + clearing deposit for the current balance domain; refreshes balances on success.
 */
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

/**
 * Withdraws collateral from clearing to the user for the given ledger asset.
 */
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

/**
 * Core account-state fetch: routes to the right canister method per path.
 *
 * - Uncertified (query) → `get_account_state_query` (declared `query` in Candid,
 *   read-only, does NOT refresh external ledger balances). Fast first paint.
 * - Certified (update)  → `get_account_state` with `refresh: true`, which
 *   re-prices mark-to-market and reconciles external ledgers. Source of truth.
 *
 * Using the same update method on both paths would double the external-ledger
 * refresh cost and side-effects on every load.
 */
const fetchAccountState = ({
	identity,
	certified,
	domain
}: {
	identity: Identity;
	certified: boolean;
	domain: ClearingDid.BalanceDomain;
}): Promise<ClearingDid.AccountStateResponse> => {
	if (certified) {
		return getAccountStateApi({
			identity,
			certified: true,
			params: { refresh: toNullable(true), domain: toNullable(domain) }
		});
	}

	// `get_account_state_query` takes no params and returns all domains; the
	// caller (see `LoaderCollaterals`) filters by domain client-side.
	return getAccountStateQueryApi({ identity, certified: false });
};

/**
 * Fetches clearing account state (balances per domain) for the signed-in user.
 *
 * Performs a single certified update. Prefer {@link loadAccountState} for UI
 * flows that benefit from the fast-then-certified render pattern.
 */
export const getAccountState = async (
	domain: ClearingDid.BalanceDomain
): Promise<ClearingDid.AccountStateResponse> => {
	const identity = await safeGetIdentityOnce();

	return fetchAccountState({ identity, certified: true, domain });
};

/**
 * Callback-based variant of {@link getAccountState}. No-op when the user is
 * not signed in.
 */
export const loadAccountState = async ({
	domain,
	onLoad,
	onUpdateError
}: {
	domain: ClearingDid.BalanceDomain;
	onLoad: (options: { certified: boolean; response: ClearingDid.AccountStateResponse }) => void;
	onUpdateError?: (error: unknown) => void;
}): Promise<void> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return;
	}

	return loadWithCertification<ClearingDid.AccountStateResponse>({
		identity,
		request: ({ certified, identity: reqIdentity }) =>
			fetchAccountState({ identity: reqIdentity, certified, domain }),
		onLoad,
		onUpdateError
	});
};

/**
 * Core collateral-assets fetch: threads identity + certified so it composes
 * with {@link loadCollateralAssets} / `queryAndUpdate`.
 */
const fetchCollateralAssets = ({
	identity,
	certified
}: {
	identity: Identity;
	certified: boolean;
}): Promise<ClearingDid.CollateralAssetInfo[]> => listCollateralAssetsApi({ identity, certified });

/**
 * Lists collateral assets configured on clearing (empty if anonymous).
 *
 * Performs a single certified update. Prefer {@link loadCollateralAssets} for
 * UI flows that benefit from the fast-then-certified render pattern.
 */
export const getCollateralAssets = async (): Promise<ClearingDid.CollateralAssetInfo[]> => {
	const identity = await getIdentityOnce();

	if (isNullish(identity)) {
		return [];
	}

	return fetchCollateralAssets({ identity, certified: true });
};

/**
 * Callback-based variant of {@link getCollateralAssets}. No-op when the user
 * is not signed in (mirrors `getCollateralAssets` returning `[]`).
 */
export const loadCollateralAssets = async ({
	onLoad,
	onUpdateError
}: {
	onLoad: (options: { certified: boolean; response: ClearingDid.CollateralAssetInfo[] }) => void;
	onUpdateError?: (error: unknown) => void;
}): Promise<void> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return;
	}

	return loadWithCertification<ClearingDid.CollateralAssetInfo[]>({
		identity,
		request: ({ certified, identity: reqIdentity }) =>
			fetchCollateralAssets({ identity: reqIdentity, certified }),
		onLoad,
		onUpdateError
	});
};

/**
 * Registers an ICRC ledger as a collateral asset on clearing (admin-style operation).
 */
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
