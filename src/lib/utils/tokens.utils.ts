import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
import { collateralsStore } from '$lib/stores/collaterals.store';
import type { Token } from '$lib/types/token';
import { findCollateralInfoByIcrcLedger } from '$lib/utils/asset-ref.utils';
import { isNullish } from '@dfinity/utils';
import { get } from 'svelte/store';

/** Looks up a supported token by ICRC ledger canister id. */
export const findTokenByLedgerId = (ledgerCanisterId: string): Token | undefined =>
	SUPPORTED_TOKENS.find((t) => t.ledgerCanisterId === ledgerCanisterId);

/**
 * Canonical clearing `asset_id` for an ICRC ledger: resolved only from registered collateral
 * config (ledger match), never from token symbol.
 */
export const resolveClearingAssetId = (ledgerCanisterId: string): string => {
	const { assetsConfig } = get(collateralsStore);
	const info = findCollateralInfoByIcrcLedger({ assetsConfig, ledgerCanisterId });

	if (isNullish(info)) {
		throw new Error(
			`No clearing collateral registered for ICRC ledger ${ledgerCanisterId}. Load collateral config or register the asset on clearing.`
		);
	}

	return info.config.asset_id;
};
