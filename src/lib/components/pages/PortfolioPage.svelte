<script lang="ts">
	import { onMount } from 'svelte';
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
	import { authPrincipal } from '$lib/derived/user.derived';
	import { getMarkets } from '$lib/services/market.services';
	import { getUserOrders } from '$lib/services/order.services';
	import { getPositions } from '$lib/services/position.services';
	import { getUserTradeHistory } from '$lib/services/trade.services';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { formatToken } from '$lib/utils/format.utils';
	import { REFRESH_POSITIONS } from '$lib/utils/refresh.utils';

	let positions = $state<Position[]>([]);
	let openOrders = $state<ClearingDid.LimitOrder[]>([]);
	let tradeHistory = $state<ClearingDid.Event[]>([]);
	let markets = $state<Market[]>([]);
	let loading = $state(true);

	const loadData = async () => {
		loading = true;
		try {
			const [posRes, ordersRes, historyRes, marketsRes] = await Promise.all([
				getPositions(),
				getUserOrders(),
				getUserTradeHistory(),
				getMarkets()
			]);

			positions = posRes;
			openOrders = ordersRes;
			tradeHistory = historyRes;
			markets = marketsRes;
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		loadData();

		const handleRefresh = () => loadData();

		window.addEventListener(REFRESH_POSITIONS, handleRefresh);

		return () => {
			window.removeEventListener(REFRESH_POSITIONS, handleRefresh);
		};
	});

	const getMarketById = (id: string) => markets.find((m) => m.id === id);

	const calculateValue = (pos: Position) => {
		const market = getMarketById(pos.marketId);
		if (!market) {
			return ZERO;
		}

		let prob = 0.5;
		if (market.payoffType === 'Binary') {
			prob = pos.outcomeId === 'YES' ? market.yesProbability : market.noProbability;
		} else {
			prob = 1 / (market.outcomes?.length ?? 1);
		}

		return BigInt(Math.floor(Number(pos.netQty) * prob));
	};

	const calculatePnL = (pos: Position) => {
		const totalUnits = pos.netQty < ZERO ? -pos.netQty : pos.netQty;
		const currentValue = calculateValue(pos);
		return Number(currentValue - totalUnits) / 10 ** 8;
	};

	const totalPortfolioValue = $derived(
		positions.reduce((acc, pos) => acc + calculateValue(pos), ZERO)
	);

	const totalPnL = $derived(positions.reduce((acc, pos) => acc + calculatePnL(pos), 0));
</script>

<div class="space-y-8">
	<SectionHeader
		description="Track your active predictions and performance in real-time."
		highlight="Portfolio"
		title="My"
	/>

	{#if loading}
		<LoadingSpinner />
	{:else}
		<!-- Stats Summary -->
		<PortfolioStats
			activeMarketsCount={positions.length}
			{totalPnL}
			totalPortfolioValue={formatToken({ value: totalPortfolioValue, unitName: 8 })}
		/>

		<!-- Positions Table -->
		<PositionTable
			{markets}
			onCalculatePnL={calculatePnL}
			onCalculateValue={calculateValue}
			{positions}
		/>

		<div class="grid grid-cols-1 gap-8 xl:grid-cols-2">
			<OpenOrdersTable {markets} onRefresh={loadData} orders={openOrders} />

			<TradeHistoryTable events={tradeHistory} {markets} />
		</div>

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
			<div class="lg:col-span-1">
				{#if $userStore.profile}
					<ProfileCard profile={$userStore.profile} viewerPrincipal={$authPrincipal ?? ''} />
				{/if}
			</div>
			<div class="lg:col-span-2">
				<ActivityFeed mode="friends" userPrincipal={$authPrincipal ?? ''} />
			</div>
		</div>
	{/if}
</div>
