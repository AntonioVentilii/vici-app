import { rankMarkets } from '$lib/services/market.services';
import type { SeriesCategory } from '$lib/types/category';
import type { Market } from '$lib/types/market';
import { getSearchScore } from '$lib/utils/search.utils';

export const filterAndRankMarkets = ({
	markets,
	searchTerm,
	activeTab,
	userInterests = [],
	categoryMappings = []
}: {
	markets: Market[];
	searchTerm: string;
	activeTab: string;
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

			return matchesTab && matchesSearch;
		})
		.map(({ market }) => market);

	return rankMarkets({
		markets: baseFiltered,
		userInterests: new Set(userInterests),
		categoryMappings
	});
};
