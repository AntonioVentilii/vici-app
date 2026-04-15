import type { ClearingDid } from '$declarations';
import type { MarketId } from '$lib/types/market';
import { parseMarketId } from '$lib/validation/market.validation';

/**
 * Converts a domain string (e.g. from JSON) to a Clearing BalanceDomain variant.
 */
export const toBalanceDomain = (domain: string): ClearingDid.BalanceDomain => {
	if (domain === 'Playground') {
		return { Playground: null };
	}

	if (domain === 'Settlement') {
		return { Settlement: null };
	}

	if (domain === 'Social') {
		return { Social: null };
	}

	return { ViciXp: null };
};

/**
 * Predicates and filters for clearing balance domains (playground, settlement, ViciXp).
 */
/**
 * On-chain testnet/sandbox domain (not used for Vici app playground UI).
 */
export const isPlayground = (domain: ClearingDid.BalanceDomain): boolean => 'Playground' in domain;

/**
 * True when the domain is production settlement collateral.
 */
export const isSettlement = (domain: ClearingDid.BalanceDomain): boolean => 'Settlement' in domain;

/**
 * True when the clearing domain is ViciXp (in-app playground experience).
 */
export const isViciXp = (domain: ClearingDid.BalanceDomain): boolean => 'ViciXp' in domain;

/**
 * True for non-monetary social bets domain.
 */
export const isSocial = (domain: ClearingDid.BalanceDomain): boolean => 'Social' in domain;

/**
 * True when the UI "Playground" tab is active (maps to `ViciXp` on the clearing).
 */
export const isPlaygroundExperience = (domain: ClearingDid.BalanceDomain): boolean =>
	isViciXp(domain);

/**
 * Equality for balance domains (Playground, Settlement, or ViciXp buckets).
 */
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

	if (isViciXp(a)) {
		return isViciXp(b);
	}

	if (isSocial(a)) {
		return isSocial(b);
	}

	return false;
};

/**
 * Keeps items whose `balanceDomain` / `balance_domain` matches `targetDomain`.
 */
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

/**
 * Like {@link filterByBalanceDomain}, but when `targetDomain` is ViciXp (playground),
 * also includes Social-domain items so that social challenges appear in the unified feed.
 */
export const filterByPlaygroundExpandedDomain = <
	T extends
		| { balanceDomain: ClearingDid.BalanceDomain }
		| { balance_domain: ClearingDid.BalanceDomain }
>({
	items,
	targetDomain
}: {
	items: T[];
	targetDomain: ClearingDid.BalanceDomain;
}): T[] => {
	if (isViciXp(targetDomain)) {
		return items.filter((item) => {
			const d = 'balanceDomain' in item ? item.balanceDomain : item.balance_domain;

			return isViciXp(d) || isSocial(d);
		});
	}

	return filterByBalanceDomain({ items, targetDomain });
};

/**
 * Keeps clearing rows whose parsed `series_id` is in `marketIds`.
 */
export const filterByMarketIds = <T extends { series_id: string }>({
	items,
	marketIds
}: {
	items: T[];
	marketIds: Set<MarketId>;
}): T[] => items.filter((item) => marketIds.has(parseMarketId(item.series_id)));
