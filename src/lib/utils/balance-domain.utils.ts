import type { ClearingDid } from '$declarations';
import type { MarketId } from '$lib/types/market';
import { parseMarketId } from '$lib/validation/market.validation';

export const isPlayground = (domain: ClearingDid.BalanceDomain): boolean => 'Playground' in domain;

export const isSettlement = (domain: ClearingDid.BalanceDomain): boolean => 'Settlement' in domain;

// eslint-disable-next-line local-rules/prefer-object-params -- Compare functions are more readable with primitive params
export const compareBalanceDomains = (
	a: ClearingDid.BalanceDomain,
	b: ClearingDid.BalanceDomain
): boolean => {
	if (isPlayground(a)) {
		return isPlayground(b);
	}

	if (isSettlement(a)) {
		return isSettlement(b);
	}

	return false;
};

export const filterByBalanceDomain = <
	T extends
		| { balanceDomain: ClearingDid.BalanceDomain }
		| { balance_domain: ClearingDid.BalanceDomain }
>({
	items,
	targetDomain
}: {
	items: T[];
	targetDomain: ClearingDid.BalanceDomain;
}): T[] =>
	items.filter((item) => {
		const itemDomain = 'balanceDomain' in item ? item.balanceDomain : item.balance_domain;
		return compareBalanceDomains(itemDomain, targetDomain);
	});

export const filterByMarketIds = <T extends { series_id: string }>({
	items,
	marketIds
}: {
	items: T[];
	marketIds: Set<MarketId>;
}): T[] => items.filter((item) => marketIds.has(parseMarketId(item.series_id)));
