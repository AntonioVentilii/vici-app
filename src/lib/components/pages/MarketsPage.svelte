<script lang="ts">
	import { onMount } from 'svelte';
	import MarketFilters from '$lib/components/market/MarketFilters.svelte';
	import MarketGrid from '$lib/components/market/MarketGrid.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { getMarkets } from '$lib/services/market.services';
	import type { Market } from '$lib/types/market';
	import { REFRESH_MARKETS } from '$lib/utils/refresh.utils';

	let markets = $state<Market[]>([]);

	let loading = $state(true);

	let searchTerm = $state('');

	let activeTab = $state('Active');

	const tabs = ['Active', 'Trending', 'Expiring', 'Resolved'];

	const loadMarkets = async () => {
		loading = true;
		try {
			markets = await getMarkets();
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		loadMarkets();
		window.addEventListener(REFRESH_MARKETS, loadMarkets);
		return () => window.removeEventListener(REFRESH_MARKETS, loadMarkets);
	});

	const filteredMarkets = $derived(
		markets.filter((m) => {
			const matchesSearch =
				m.title.toLowerCase().includes(searchTerm.toLowerCase()) ??
				m.description.toLowerCase().includes(searchTerm.toLowerCase());
			const matchesTab =
				activeTab === 'Active' ||
				(activeTab === 'Resolved' && m.status === 'Resolved') ||
				(activeTab === 'Expiring' && m.status === 'Expired') ||
				activeTab === 'Trending'; // Mock trending as all open for now
			return matchesSearch && matchesTab;
		})
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
