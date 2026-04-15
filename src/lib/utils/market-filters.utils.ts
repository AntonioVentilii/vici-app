import { rankMarkets } from '$lib/services/market.services';
import type { SeriesCategory } from '$lib/types/category';
import type { Market } from '$lib/types/market';
import type { MarketSecondaryFilters } from '$lib/types/market-filters';
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
	categoryMappings = []
}: {
	markets: Market[];
	searchTerm: string;
	activeTab: string;
	filters: MarketSecondaryFilters;
	userInterests?: string[];
	categoryMappings?: SeriesCategory[];
}): Market[] => {
	const baseFiltered = markets
		.map((market) => ({
			market,
			searchScore: getSearchScore({ market, searchTerm })
		}))
		.filter(({ market, searchScore }) => {
			const matchesSearch = searchScore > 0;
			const matchesTab =
				activeTab === 'Active' ||
				(activeTab === 'Resolved' && market.status === 'Resolved') ||
				(activeTab === 'Expiring' && market.status === 'Expired') ||
				activeTab === 'Trending';

			return matchesTab && matchesSearch && matchesSecondaryFilters({ market, filters });
		})
		.map(({ market }) => market);

	return rankMarkets({
		markets: baseFiltered,
		userInterests: new Set(userInterests),
		categoryMappings
	});
};
