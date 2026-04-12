import type { ClearingDid, RegistryDid } from '$declarations';
import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import type { Token } from '$lib/types/token';
import { assetToToken } from '$lib/utils/asset.utils';
import { isViciXp } from '$lib/utils/balance-domain.utils';

/**
 * Resolves the display token for a market from balance domain and payout unit (VXP or ledger-mapped asset).
 */
export const resolveMarketDisplayToken = ({
	balanceDomain,
	payoutUnit
}: {
	balanceDomain: ClearingDid.BalanceDomain;
	payoutUnit: RegistryDid.PayoutUnit;
}): Token | undefined => {
	if (isViciXp(balanceDomain)) {
		return VXP_TOKEN;
	}

	return assetToToken(payoutUnit);
};
