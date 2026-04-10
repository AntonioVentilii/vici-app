<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import type { ClearingDid } from '$declarations';
	import OpenOrdersTable from '$lib/components/portfolio/OpenOrdersTable.svelte';
	import PortfolioStats from '$lib/components/portfolio/PortfolioStats.svelte';
	import PositionTable from '$lib/components/portfolio/PositionTable.svelte';
	import TradeHistoryTable from '$lib/components/portfolio/TradeHistoryTable.svelte';
	import ActivityFeed from '$lib/components/social/ActivityFeed.svelte';
	import ProfileCard from '$lib/components/social/ProfileCard.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { orders, ordersNotInitialized } from '$lib/derived/orders.derived';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { getPositions } from '$lib/services/position.services';
	import { getUserTradeHistory } from '$lib/services/trade.services';
	import { balanceDomainStore } from '$lib/stores/balance-domain.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Position } from '$lib/types/position';
	import {
		formatPortfolioHoldingsStatLine,
		formatPortfolioPnLStatLine
	} from '$lib/utils/playground-display.utils';
	import { calculatePositionPnL, calculatePositionValue } from '$lib/utils/portfolio.utils';

	let positions = $state<Position[]>([]);
	let tradeHistory = $state<ClearingDid.Event[]>([]);

	let loading = $state(true);

	let refreshing = $derived(loading || $marketsNotInitialized || $ordersNotInitialized);

	const loadData = async () => {
		loading = true;

		try {
			const [posRes, historyRes] = await Promise.all([
				getPositions($balanceDomain),
				getUserTradeHistory($balanceDomain)
			]);

			positions = posRes;
			tradeHistory = historyRes;
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		loadData();
	});

	$effect(() => {
		if (nonNullish($balanceDomain)) {
			loadData();
		}
	});

	const getMarketById = (id: string) => $markets.find((m) => m.id === id);

	const totalPortfolioValue = $derived(
		positions.reduce(
			(acc, pos) =>
				acc + calculatePositionValue({ position: pos, market: getMarketById(pos.marketId) }),
			ZERO
		)
	);

	const totalPnL = $derived(
		positions.reduce(
			(acc, pos) =>
				acc + calculatePositionPnL({ position: pos, market: getMarketById(pos.marketId) }),
			0
		)
	);

	const portfolioHoldingsLabel = $derived(
		formatPortfolioHoldingsStatLine({
			playground: $playgroundVxpUnitMode,
			totalPortfolioValue,
			sampleToken: positions[0] ? getMarketById(positions[0].marketId)?.token : undefined
		})
	);

	const portfolioPnLLabel = $derived(
		formatPortfolioPnLStatLine({ totalPnL, playground: $playgroundVxpUnitMode })
	);
</script>

<svelte:document onviciRefreshPositions={loadData} />

<div class="space-y-8">
	<SectionHeader
		description="Track your active predictions and performance in real-time."
		highlight="Portfolio"
		title="My"
	/>

	{#if refreshing}
		<LoadingSpinner />
	{:else}
		{#if $balanceDomainStore.value !== 'social'}
			<div transition:slide>
				<PortfolioStats
					activeMarketsCount={positions.length}
					pnlVariant={totalPnL >= 0 ? 'success' : 'default'}
					totalHoldings={portfolioHoldingsLabel}
					totalPnL={portfolioPnLLabel}
				/>
			</div>
		{/if}

		<PositionTable markets={$markets} {positions} />

		<div class="grid grid-cols-1 gap-8 xl:grid-cols-2">
			<OpenOrdersTable markets={$markets} onRefresh={loadData} orders={$orders} />

			<TradeHistoryTable events={tradeHistory} markets={$markets} />
		</div>

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
			<div class="lg:col-span-1">
				{#if nonNullish($userStore.profile)}
					<ProfileCard profile={$userStore.profile} viewerPrincipal={$authPrincipal ?? ''} />
				{/if}
			</div>
			<div class="lg:col-span-2">
				<ActivityFeed mode="friends" userPrincipal={$authPrincipal ?? ''} />
			</div>
		</div>
	{/if}
</div>
