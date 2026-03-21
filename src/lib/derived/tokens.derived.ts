import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
import { balanceDomain } from '$lib/derived/balance-domain.derived';
import { collateralsStore } from '$lib/stores/collaterals.store';
import type { Token } from '$lib/types/token';
import { compareBalanceDomains } from '$lib/utils/balance-domain.utils';
import { isNullish } from '@dfinity/utils';
import { derived, type Readable } from 'svelte/store';

export const supportedTokens: Readable<Token[]> = derived(
	[balanceDomain, collateralsStore],
	([$balanceDomain, $collateralsStore]) => {
		const { assetsConfig } = $collateralsStore;

		return SUPPORTED_TOKENS.filter((token) => {
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
	}
);

export const defaultSupportedToken: Readable<Token | undefined> = derived(
	supportedTokens,
	($supportedTokens) => ($supportedTokens.length > 0 ? $supportedTokens[0] : undefined)
);
