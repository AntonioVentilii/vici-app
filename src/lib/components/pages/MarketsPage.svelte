<script lang="ts">
	import { onMount } from 'svelte';
	import MarketFeed from '$lib/components/market/MarketFeed.svelte';
	import MarketFilters from '$lib/components/market/MarketFilters.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { listSeriesCategories } from '$lib/services/category.services';
	import { userStore } from '$lib/stores/user.store';
	import type { SeriesCategory } from '$lib/types/category';
	import {
		DEFAULT_SECONDARY_FILTERS,
		type MarketSecondaryFilters
	} from '$lib/types/market-filters';
	import { filterAndRankMarkets } from '$lib/utils/market-filters.utils';

	let loading = $derived($marketsNotInitialized);

	let searchTerm = $state('');
	let activeTab = $state('Active');
	let filters = $state<MarketSecondaryFilters>({ ...DEFAULT_SECONDARY_FILTERS });
	let categoryMappings = $state<SeriesCategory[]>([]);

	onMount(async () => {
		categoryMappings = await listSeriesCategories();
	});

	const tabs = ['Active', 'Trending', 'Expiring', 'Resolved'];

	const filteredMarkets = $derived(
		filterAndRankMarkets({
			markets: $markets,
			searchTerm,
			activeTab,
			filters,
			userInterests: $userStore.profile?.interests ?? [],
			categoryMappings
		})
	);
</script>

<section class="space-y-8">
	<SectionHeader
		description="Explore and predict markets."
		highlight="Markets"
		title="Prediction"
	/>

	<div class="w-full space-y-8">
		<div class="space-y-8">
			<MarketFilters
				{activeTab}
				{filters}
				onFiltersChange={(f) => (filters = f)}
				onSearchChange={(term) => (searchTerm = term)}
				onTabChange={(tab) => (activeTab = tab)}
				{searchTerm}
				{tabs}
			/>

			<MarketFeed {loading} markets={filteredMarkets} />
		</div>
	</div>
</section>
