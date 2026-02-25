<script lang="ts">
	import MarketCard from '$lib/components/MarketCard.svelte';
	import { mockBackend, type Market } from '$lib/services/mockBackend';
	import { onMount } from 'svelte';

	let markets: Market[] = $state([]);
	let loading = $state(true);
	let searchTerm = $state('');
	let activeTab = $state('All');

	const tabs = ['All', 'Trending', 'Expiring', 'Resolved'];

	onMount(async () => {
		markets = await mockBackend.getMarkets();
		loading = false;
	});

	let filteredMarkets = $derived(
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
	<!-- Hero Header -->
	<div class="space-y-4">
		<h1 class="max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
			The World's First <span
				class="bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent"
				>Social Prediction</span
			> Market
		</h1>
		<p class="max-w-2xl text-lg text-gray-400">
			Predict outcomes, trade positions, and compete with friends. Built on the Internet Computer
			for speed, security, and true decentralization.
		</p>
	</div>

	<!-- Controls & Filters -->
	<div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
		<div class="flex flex-wrap gap-2">
			{#each tabs as tab}
				<button
					onclick={() => (activeTab = tab)}
					class="rounded-xl px-5 py-2.5 text-sm font-bold transition-all {activeTab === tab
						? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
						: 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}"
				>
					{tab}
				</button>
			{/each}
		</div>

		<div class="relative w-full lg:max-w-sm">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
				<svg
					class="h-5 w-5 text-gray-500"
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
						clip-rule="evenodd"
					/>
				</svg>
			</div>
			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Search markets..."
				class="block w-full rounded-xl border-none bg-white/5 py-3 pr-4 pl-10 text-sm text-white placeholder-gray-500 ring-1 ring-white/10 transition-all ring-inset focus:bg-white/10 focus:ring-2 focus:ring-indigo-500"
			/>
		</div>
	</div>

	<!-- Markets Grid -->
	{#if loading}
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as _}
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
		<div
			class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 py-20 text-center"
		>
			<div
				class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-gray-500"
			>
				<svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</div>
			<h3 class="text-xl font-bold text-white">No markets found</h3>
			<p class="mt-2 text-gray-400">Try adjusting your filters or search term.</p>
		</div>
	{/if}
</section>
