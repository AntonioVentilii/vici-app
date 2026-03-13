<script lang="ts">
	import MarketFilters from '$lib/components/market/MarketFilters.svelte';
	import MarketGrid from '$lib/components/market/MarketGrid.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';

	let loading = $derived($marketsNotInitialized);

	let searchTerm = $state('');

	let activeTab = $state('Active');

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

	const filteredMarkets = $derived(
		$markets
			.map((market) => ({
				market,
				score: getSearchScore({ market, searchTerm })
			}))
			.filter(({ market, score }) => {
				const matchesTab =
					activeTab === 'Active' ||
					(activeTab === 'Resolved' && market.status === 'Resolved') ||
					(activeTab === 'Expiring' && market.status === 'Expired') ||
					activeTab === 'Trending';

				return matchesTab && score > 0;
			})
			.sort((a, b) => b.score - a.score)
			.map(({ market }) => market)
	);
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
				onSearchChange={(term) => (searchTerm = term)}
				onTabChange={(tab) => (activeTab = tab)}
				{searchTerm}
				{tabs}
			/>

			<!-- Markets Grid -->
			<MarketGrid {loading} markets={filteredMarkets} />
		</div>
	</div>
</section>
