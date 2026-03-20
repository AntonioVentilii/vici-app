<script lang="ts">
	import { onMount } from 'svelte';
	import MarketFeed from '$lib/components/market/MarketFeed.svelte';
	import MarketFilters from '$lib/components/market/MarketFilters.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { listSeriesCategories } from '$lib/services/category.services';
	import { rankMarkets } from '$lib/services/market.services';
	import { userStore } from '$lib/stores/user.store';
	import type { SeriesCategory } from '$lib/types/category';
	import type { Market } from '$lib/types/market';

	let loading = $derived($marketsNotInitialized);

	let searchTerm = $state('');
	let activeTab = $state('Active');
	let categoryMappings = $state<SeriesCategory[]>([]);

	onMount(async () => {
		categoryMappings = await listSeriesCategories();
	});

	const tabs = ['Active', 'Trending', 'Expiring', 'Resolved'];

	const normalise = (value: string): string =>
		value
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^\p{L}\p{N}\s]/gu, ' ')
			.replace(/\s+/g, ' ')
			.trim();

	const getSearchScore = ({
		market,
		searchTerm
	}: {
		market: { title: string; description: string };
		searchTerm: string;
	}): number => {
		const query = normalise(searchTerm);

		if (query === '') {
			return 1;
		}

		const title = normalise(market.title);
		const description = normalise(market.description);
		const terms = query.split(/\s+/).filter(Boolean);

		let score = 0;

		if (title.includes(query)) {
			score += 10;
		}

		if (description.includes(query)) {
			score += 5;
		}

		for (const term of terms) {
			if (title.includes(term)) {
				score += 3;
			}

			if (description.includes(term)) {
				score += 1;
			}
		}

		return score;
	};

	const filteredMarkets = $derived.by(() => {
		const baseFiltered = $markets
			.map((market: Market) => ({
				market,
				searchScore: getSearchScore({ market, searchTerm })
			}))
			.filter(({ market, searchScore }: { market: Market; searchScore: number }) => {
				const matchesSearch = searchScore > 0;
				const matchesTab =
					activeTab === 'Active' ||
					(activeTab === 'Resolved' && market.status === 'Resolved') ||
					(activeTab === 'Expiring' && market.status === 'Expired') ||
					activeTab === 'Trending';

				return matchesTab && matchesSearch;
			})
			.map(({ market }) => market);

		// Apply Personalized Ranking
		return rankMarkets({
			markets: baseFiltered,
			userInterests: new Set($userStore.profile?.interests ?? []),
			categoryMappings
		});
	});
</script>

<section class="space-y-8">
	<SectionHeader
		description="Explore and predict markets."
		highlight="Markets"
		title="Prediction"
	/>

	<div class="grid grid-cols-1 items-start gap-6 space-y-8 lg:col-span-3 lg:grid-cols-3">
		<div class="space-y-8 lg:col-span-3">
			<!-- Controls & Filters -->
			<MarketFilters
				{activeTab}
				onSearchChange={(term: string) => (searchTerm = term)}
				onTabChange={(tab: string) => (activeTab = tab)}
				{searchTerm}
				{tabs}
			/>

			<!-- Markets Feed -->
			<MarketFeed {loading} markets={filteredMarkets} />
		</div>
	</div>
</section>
