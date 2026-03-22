import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
import { balanceDomain } from '$lib/derived/balance-domain.derived';
import { collateralsStore } from '$lib/stores/collaterals.store';
import type { Token } from '$lib/types/token';
import { compareBalanceDomains } from '$lib/utils/balance-domain.utils';
import { filterTokensForBalanceDomain } from '$lib/utils/playground-token.utils';
import { isNullish } from '@dfinity/utils';
import { derived, type Readable } from 'svelte/store';

export const supportedTokens: Readable<Token[]> = derived(
	[balanceDomain, collateralsStore],
	([$balanceDomain, $collateralsStore]) => {
		const { assetsConfig } = $collateralsStore;

		const filteredByClearing = SUPPORTED_TOKENS.filter((token) => {
			// Find the corresponding asset in the clearing configuration
			const assetInfo = Object.values(assetsConfig).find((info) => {
				const { asset } = info.config;

				if ('Icrc' in asset) {
					return asset.Icrc.toText() === token.ledgerCanisterId;
				}

				// Add other asset types (Erc20, etc.) here when supported
				return false;
			});

			if (isNullish(assetInfo)) {
				return false;
			}

			// Check if the asset is enabled and allowed in the current domain
			const { is_enabled, allowed_balance_domains } = assetInfo.config;
			if (!is_enabled) {
				return false;
			}

			return allowed_balance_domains.some((d) => compareBalanceDomains(d, $balanceDomain));
		});

		return filterTokensForBalanceDomain({
			tokens: filteredByClearing,
			balanceDomain: $balanceDomain
		});
	}
);

/**
 * Tokens shown in wallet UI (asset rows, send, history filter). Prefers clearing-aligned
 * {@link supportedTokens}; if that list is empty (collateral config not loaded, no match, etc.),
 * falls back to domain-sliced {@link SUPPORTED_TOKENS} so ledger balances still display.
 */
export const walletUiTokens: Readable<Token[]> = derived(
	[supportedTokens, balanceDomain],
	([$supportedTokens, $balanceDomain]) => {
		if ($supportedTokens.length > 0) {
			return $supportedTokens;
		}

		return filterTokensForBalanceDomain({
			tokens: SUPPORTED_TOKENS,
			balanceDomain: $balanceDomain
		});
	}
);

export const defaultSupportedToken: Readable<Token | undefined> = derived(
	walletUiTokens,
	($walletUiTokens) => ($walletUiTokens.length > 0 ? $walletUiTokens[0] : undefined)
);
