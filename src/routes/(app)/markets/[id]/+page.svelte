<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import MarketDetailForecast from '$lib/components/market/MarketDetailForecast.svelte';
	import MarketDetailHeader from '$lib/components/market/MarketDetailHeader.svelte';
	import MarketDetailStats from '$lib/components/market/MarketDetailStats.svelte';
	import MarketDetailTabs from '$lib/components/market/MarketDetailTabs.svelte';
	import MarketInfoPanel from '$lib/components/market/MarketInfoPanel.svelte';
	import MarketResolutionInterface from '$lib/components/market/MarketResolutionInterface.svelte';
	import { pageMarketId } from '$lib/derived/page-market.derived';
	import { userIsAdminOrResolver } from '$lib/derived/user.derived';
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

<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
	{#if loading}
		<div class="flex h-96 items-center justify-center">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"
			></div>
		</div>
	{:else if market}
		<div class="space-y-8 lg:space-y-12">
			<!-- Market Header - Always at the top, centered -->
			<MarketDetailHeader {market} />

			<!-- Main Content Grid -->
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
				<!-- Left Column: Primary Market Actions -->
				<div class="space-y-8 lg:col-span-8">
					<!-- Mobile-only Stats (Horizontal) -->
					<div class="lg:hidden">
						<MarketDetailStats {market} />
					</div>

					<MarketDetailForecast {market} {onPredictionPlaced} />

					<MarketDetailTabs {market} {positions} />
				</div>

				<!-- Right Column: Sidebar Info (Visible from LG+) -->
				<aside class="hidden space-y-8 lg:col-span-4 lg:block">
					<MarketInfoPanel {market} />
				</aside>

				<!-- Mobile fallback for sidebar components if needed at bottom -->
				<div class="space-y-8 lg:hidden">
					<MarketInfoPanel {market} />
				</div>
			</div>

			<!-- Admin Resolution Section -->
			{#if market.status === 'Open' && $userIsAdminOrResolver}
				<div class="mx-auto max-w-4xl border-t border-slate-100 pt-12">
					<MarketResolutionInterface
						{market}
						onSettled={() => {
							if (nonNullish(market)) {
								fetchMarket(market.id);
							}
						}}
					/>
				</div>
			{/if}
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
