<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
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
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { orders, ordersNotInitialized } from '$lib/derived/orders.derived';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { getPositions } from '$lib/services/position.services';
	import { getUserTradeHistory } from '$lib/services/trade.services';
	import { userStore } from '$lib/stores/user.store';
	import type { Position } from '$lib/types/position';
	import { formatCurrency } from '$lib/utils/format.utils';

	let positions = $state<Position[]>([]);
	let tradeHistory = $state<ClearingDid.Event[]>([]);

	let loading = $state(true);

	let refreshing = $derived(loading || $marketsNotInitialized || $ordersNotInitialized);

	const loadData = async () => {
		loading = true;
		try {
			const [posRes, historyRes] = await Promise.all([getPositions(), getUserTradeHistory()]);

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

	const calculateValue = (pos: Position) => {
		const market = getMarketById(pos.marketId);
		if (isNullish(market)) {
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
		const market = getMarketById(pos.marketId);
		if (isNullish(market)) {
			return 0;
		}

		const currentValue = calculateValue(pos);
		// lockedCollateral is USD (6 decimals). currentValue has token decimals.
		// Normalize both to number for P&L display
		const valNum = Number(currentValue) / 10 ** (market.token.decimals ?? 8);
		const costNum = Number(pos.lockedCollateral) / 10 ** 6;

		return valNum - costNum;
	};

	const totalPortfolioValue = $derived(
		positions.reduce((acc, pos) => acc + calculateValue(pos), ZERO)
	);

	const totalPnL = $derived(positions.reduce((acc, pos) => acc + calculatePnL(pos), 0));
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
		<!-- Stats Summary -->
		<PortfolioStats
			activeMarketsCount={positions.length}
			pnlVariant={totalPnL >= 0 ? 'success' : 'default'}
			totalHoldings={formatCurrency({ value: totalPortfolioValue, decimals: 8, symbol: 'ICP' })}
			totalPnL={(totalPnL >= 0 ? '+' : '') + totalPnL.toFixed(2)}
		/>

		<!-- Positions Table -->
		<PositionTable
			markets={$markets}
			onCalculatePnL={calculatePnL}
			onCalculateValue={calculateValue}
			{positions}
		/>

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
