import type { MarketTag } from '$lib/constants/market-tags.constants';
import { rankMarkets } from '$lib/services/market.services';
import type { Market } from '$lib/types/market';
import type { MarketSecondaryFilters } from '$lib/types/market-filters';
import type { MarketMetadata } from '$lib/types/market-metadata';
import { isSocial, isViciXp } from '$lib/utils/balance-domain.utils';
import { getSearchScore } from '$lib/utils/search.utils';

const matchesSecondaryFilters = ({
	market,
	filters
}: {
	market: Market;
	filters: MarketSecondaryFilters;
}): boolean => {
	if (filters.kind !== 'all') {
		const isChallenge = isSocial(market.balanceDomain);

		if (filters.kind === 'challenge' && !isChallenge) {
			return false;
		}

		if (filters.kind === 'market' && isChallenge) {
			return false;
		}
	}

	if (filters.payout !== 'all') {
		const isVxp = isViciXp(market.balanceDomain);

		if (filters.payout === 'vxp' && !isVxp) {
			return false;
		}

		if (filters.payout === 'non-monetary' && isVxp) {
			return false;
		}
	}

	if (filters.access !== 'all') {
		if (filters.access === 'open' && market.isInviteOnly) {
			return false;
		}

		if (filters.access === 'closed' && !market.isInviteOnly) {
			return false;
		}
	}

	return true;
};

export const filterAndRankMarkets = ({
	markets,
	searchTerm,
	activeTab,
	filters,
	userInterests = [],
	tagMappings = {},
	metadataBySeries = {}
}: {
	markets: Market[];
	searchTerm: string;
	activeTab: string;
	filters: MarketSecondaryFilters;
	userInterests?: string[];
	tagMappings?: Record<string, MarketTag[]>;
	metadataBySeries?: Record<string, MarketMetadata>;
}): Market[] => {
	const baseFiltered = markets
		.map((market) => ({
			market,
			searchScore: getSearchScore({ market, searchTerm })
		}))
		.filter(({ market, searchScore }) => {
			const matchesSearch = searchScore > 0;
			// `Active` and `Trending` previously used unconditional `||` clauses,
			// which meant every market (including resolved and expired ones) fell
			// through. Both tabs now explicitly exclude non-open markets.
			const isOpen = market.status === 'Open';
			const matchesTab =
				(activeTab === 'Active' && isOpen) ||
				(activeTab === 'Trending' && isOpen) ||
				(activeTab === 'Resolved' && market.status === 'Resolved') ||
				(activeTab === 'Expiring' && market.status === 'Expired');

			return matchesTab && matchesSearch && matchesSecondaryFilters({ market, filters });
		})
		.map(({ market }) => market);

	return rankMarkets({
		markets: baseFiltered,
		userInterests: new Set(userInterests),
		tagMappings,
		metadataBySeries
	});
};
