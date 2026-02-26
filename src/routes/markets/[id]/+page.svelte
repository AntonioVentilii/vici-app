<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import MarketDetailForecast from '$lib/components/market/MarketDetailForecast.svelte';
	import MarketDetailHeader from '$lib/components/market/MarketDetailHeader.svelte';
	import MarketDetailSidebar from '$lib/components/market/MarketDetailSidebar.svelte';
	import MarketDetailStats from '$lib/components/market/MarketDetailStats.svelte';
	import { pageMarketId } from '$lib/derived/page-market.derived';
	import { getMarket } from '$lib/services/market.service';
	import type { Market, MarketId } from '$lib/types/market';

	let market = $state<Market | undefined>();
	let loading = $state(true);

	const fetchMarket = async (id: MarketId) => {
		loading = true;
		market = await getMarket(id);
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

	const getTimeRemaining = (expiry: number) => {
		const now = Date.now();
		const diff = expiry - now;
		if (diff <= 0) {
			return 'Expired';
		}

		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

		if (days > 0) {
			return `${days}d ${hours}h ${minutes}m`;
		}
		return `${hours}h ${minutes}m remaining`;
	};

	const formatVolume = (v: bigint) => (Number(v) / 100_000_000).toFixed(2);

	const onPredictionPlaced = () => {
		if (nonNullish(market)) {
			fetchMarket(market.id);
		}
	};
</script>

<svelte:head>
	<title>{market ? market.title : 'Market'} | Vici Social Markets</title>
</svelte:head>

<div class="space-y-12">
	{#if loading}
		<div class="flex h-96 items-center justify-center">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"
			></div>
		</div>
	{:else if market}
		<!-- Market Header -->
		<div class="grid grid-cols-1 gap-12 lg:grid-cols-3">
			<div class="space-y-8 lg:col-span-2">
				<MarketDetailHeader
					id={market.id}
					description={market.description}
					status={market.status}
					title={market.title}
				/>

				<MarketDetailStats
					expiryDate={market.expiryDate}
					onFormatVolume={formatVolume}
					timeRemaining={getTimeRemaining(market.expiryDate)}
					totalVolume={market.totalVolume}
				/>

				<MarketDetailForecast
					noProbability={market.noProbability}
					noVolume={market.noVolume}
					onFormatVolume={formatVolume}
					yesProbability={market.yesProbability}
					yesVolume={market.yesVolume}
				/>
			</div>

			<MarketDetailSidebar {market} {onPredictionPlaced} />
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<h1 class="text-4xl font-extrabold text-slate-950">404 - Market Not Found</h1>
			<p class="mt-4 text-slate-600">
				The market you are seeking is either hidden or does not exist.
			</p>
			<a
				class="mt-8 rounded-xl bg-indigo-600 px-8 py-3 font-bold text-white transition-all hover:bg-indigo-700"
				href="/"
			>
				Return to Markets
			</a>
		</div>
	{/if}
</div>
