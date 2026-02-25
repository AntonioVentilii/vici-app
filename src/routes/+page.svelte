<script lang="ts">
	import { onMount } from 'svelte';
	import MarketFilters from '$lib/components/market/MarketFilters.svelte';
	import MarketGrid from '$lib/components/market/MarketGrid.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { mockBackend, type Market } from '$lib/services/mockBackend';

	let markets: Market[] = $state([]);
	let loading = $state(true);
	let searchTerm = $state('');
	let activeTab = $state('All');

	const tabs = ['All', 'Trending', 'Expiring', 'Resolved'];

	onMount(async () => {
		markets = await mockBackend.getMarkets();
		loading = false;
	});

	const filteredMarkets = $derived(
		markets.filter((m) => {
			const matchesSearch =
				m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
				m.description.toLowerCase().includes(searchTerm.toLowerCase());
			const matchesTab =
				activeTab === 'All' ||
				(activeTab === 'Resolved' && m.status === 'Resolved') ||
				(activeTab === 'Expiring' && m.status === 'Expired') ||
				activeTab === 'Trending'; // Mock trending as all open for now
			return matchesSearch && matchesTab;
		})
	);
</script>

<svelte:head>
	<title>Vici Social Markets | Predict. Trade. Win.</title>
	<meta
		name="description"
		content="Trade on binary outcome markets with social features on the Internet Computer."
	/>
</svelte:head>

<section class="space-y-12">
	<SectionHeader
		description="Predict outcomes, trade positions, and compete with friends. Built on the Internet Computer for speed, security, and true decentralization."
		highlight="Social Prediction Market"
		title="The World's First"
	/>

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
</section>
