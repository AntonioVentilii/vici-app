<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import MarketDetailForecast from '$lib/components/market/MarketDetailForecast.svelte';
	import MarketDetailHeader from '$lib/components/market/MarketDetailHeader.svelte';
	import MarketDetailSidebar from '$lib/components/market/MarketDetailSidebar.svelte';
	import MarketDetailStats from '$lib/components/market/MarketDetailStats.svelte';
	import MarketDetailTabs from '$lib/components/market/MarketDetailTabs.svelte';
	import { pageMarketId } from '$lib/derived/page-market.derived';
	import { getMarket } from '$lib/services/market.services';
	import { getPositionsForMarket } from '$lib/services/position.services';
	import type { Market, MarketId } from '$lib/types/market';
	import type { Position } from '$lib/types/position';

	let market = $state<Market | undefined>();

	let positions = $state<Position[]>([]);

	let loading = $state(true);

	const fetchMarket = async (id: MarketId) => {
		loading = true;

		const [marketRes, positionsRes] = await Promise.all([getMarket(id), getPositionsForMarket(id)]);

		market = marketRes;
		positions = positionsRes;

		loading = false;
	};

	onMount(() => {
		if (nonNullish($pageMarketId)) {
			fetchMarket($pageMarketId);
		}
	});

	$effect(() => {
		if (nonNullish($pageMarketId) && (isNullish(market) || market.id !== $pageMarketId)) {
			fetchMarket($pageMarketId);
		}
	});

	const onPredictionPlaced = () => {
		if (nonNullish(market)) {
			fetchMarket(market.id);
		}
	};
</script>

<svelte:head>
	<title>{market ? market.title : 'Market'} | Vici Social Markets</title>
</svelte:head>

<div class="space-y-8">
	{#if loading}
		<div class="flex h-96 items-center justify-center">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"
			></div>
		</div>
	{:else if market}
		<!-- Market Header -->
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
			<div class="space-y-6 lg:col-span-2">
				<MarketDetailHeader {market} />

				<MarketDetailStats {market} />

				<MarketDetailForecast {market} />

				<MarketDetailTabs {market} {positions} />
			</div>

			<MarketDetailSidebar
				{market}
				onMarketSettled={() => {
					if (nonNullish(market)) {
						fetchMarket(market.id);
					}
				}}
				{onPredictionPlaced}
				position={positions[0]}
			/>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<h1 class="text-4xl font-extrabold text-slate-950">404 - Market Not Found</h1>
			<p class="mt-4 text-slate-600">
				The market you are seeking is either hidden or does not exist.
			</p>
			<a
				class="mt-8 rounded-xl bg-indigo-600 px-8 py-3 font-bold text-white transition-all hover:bg-indigo-700"
				href="/static"
			>
				Return to Markets
			</a>
		</div>
	{/if}
</div>
