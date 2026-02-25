<script lang="ts">
	import { page } from '$app/state';
	import { mockBackend, type Market } from '$lib/services/mockBackend';
	import { onMount } from 'svelte';

	let marketId = $derived(page.params.id);
	let market = $state<Market | null>(null);
	let loading = $state(true);

	onMount(async () => {
		market = await mockBackend.getMarket(marketId);
		loading = false;
	});
</script>

<div class="flex flex-col items-center justify-center py-20 text-center">
	{#if loading}
		<div
			class="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"
		></div>
	{:else if market}
		<h1 class="text-4xl font-extrabold text-white">{market.title}</h1>
		<p class="mt-4 text-gray-400">Market Detail view for ID: {marketId} is coming soon!</p>
	{:else}
		<h1 class="text-4xl font-extrabold text-white">Market Not Found</h1>
		<p class="mt-4 text-gray-400">The market you are looking for does not exist.</p>
	{/if}
</div>
