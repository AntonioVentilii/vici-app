<script lang="ts">
	import { onMount } from 'svelte';
	import MarketCard from '$lib/components/market/MarketCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
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
	<div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
		<div class="flex flex-wrap gap-2">
			{#each tabs as tab (tab)}
				<button
					class="rounded-xl px-5 py-2.5 text-sm font-bold transition-all {activeTab === tab
						? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
						: 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}"
					onclick={() => (activeTab = tab)}
				>
					{tab}
				</button>
			{/each}
		</div>

		<div class="relative w-full lg:max-w-sm">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
				<svg
					class="h-5 w-5 text-gray-500"
					aria-hidden="true"
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path
						clip-rule="evenodd"
						d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
						fill-rule="evenodd"
					/>
				</svg>
			</div>
			<input
				class="block w-full rounded-xl border-none bg-white/5 py-3 pr-4 pl-10 text-sm text-white placeholder-gray-500 ring-1 ring-white/10 transition-all ring-inset focus:bg-white/10 focus:ring-2 focus:ring-indigo-500"
				placeholder="Search markets..."
				type="text"
				bind:value={searchTerm}
			/>
		</div>
	</div>

	<!-- Markets Grid -->
	{#if loading}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as i (i)}
				<div class="h-80 animate-pulse rounded-2xl bg-white/5"></div>
			{/each}
		</div>
	{:else if filteredMarkets.length > 0}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each filteredMarkets as market (market.id)}
				<MarketCard {market} />
			{/each}
		</div>
	{:else}
		<EmptyState message="No markets found. Try adjusting your filters or search term." />
	{/if}
</section>
