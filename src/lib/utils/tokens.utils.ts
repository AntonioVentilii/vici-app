import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
import type { Token } from '$lib/types/token';
import { isNullish } from '@dfinity/utils';

/** Looks up a supported token by ICRC ledger canister id. */

export const findTokenByLedgerId = (ledgerCanisterId: string): Token | undefined =>
	SUPPORTED_TOKENS.find((t) => t.ledgerCanisterId === ledgerCanisterId);

/** Returns the clearing `asset_id` string (lowercase symbol) for a ledger, or throws if unknown. */
export const getAssetIdByLedgerId = (ledgerCanisterId: string): string => {
	const token = findTokenByLedgerId(ledgerCanisterId);

	if (isNullish(token)) {
		throw new Error(`Unsupported collateral token ledger: ${ledgerCanisterId}`);
	}

	return token.symbol.toLowerCase();
};
