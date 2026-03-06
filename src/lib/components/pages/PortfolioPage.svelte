<script lang="ts">
	import { onMount } from 'svelte';
	import PortfolioStats from '$lib/components/portfolio/PortfolioStats.svelte';
	import PositionTable from '$lib/components/portfolio/PositionTable.svelte';
	import ActivityFeed from '$lib/components/social/ActivityFeed.svelte';
	import ProfileCard from '$lib/components/social/ProfileCard.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { getMarkets } from '$lib/services/market.services';
	import { getPositions } from '$lib/services/position.services';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { formatAmount } from '$lib/utils/format.utils';
	import { REFRESH_BALANCE, REFRESH_POSITIONS } from '$lib/utils/refresh.utils';

	let positions = $state<Position[]>([]);
	let markets = $state<Market[]>([]);
	let loading = $state(true);

	const loadData = async () => {
		loading = true;
		try {
			[positions, markets] = await Promise.all([getPositions(), getMarkets()]);
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		loadData();

		const handleRefresh = () => loadData();

		window.addEventListener(REFRESH_POSITIONS, handleRefresh);
		window.addEventListener(REFRESH_BALANCE, handleRefresh);

		return () => {
			window.removeEventListener(REFRESH_POSITIONS, handleRefresh);
			window.removeEventListener(REFRESH_BALANCE, handleRefresh);
		};
	});

	const getMarketById = (id: string) => markets.find((m) => m.id === id);

	const calculateValue = (pos: Position) => {
		const market = getMarketById(pos.marketId);
		if (!market) {
			return ZERO;
		}

		// Simple value projection: amount * current probability
		const yesVal = Number(pos.yesAmount) * market.yesProbability;
		const noVal = Number(pos.noAmount) * market.noProbability;
		return BigInt(Math.floor(yesVal + noVal));
	};

	const calculatePnL = (pos: Position) => {
		const totalCost = pos.yesAmount + pos.noAmount;
		const currentValue = calculateValue(pos);
		return Number(currentValue - totalCost) / 100_000_000;
	};

	const totalPortfolioValue = $derived(
		positions.reduce((acc, pos) => acc + calculateValue(pos), ZERO)
	);

	const totalPnL = $derived(positions.reduce((acc, pos) => acc + calculatePnL(pos), 0));
</script>

<div class="space-y-12">
	<SectionHeader
		description="Track your active predictions and see how your trades are performing in real-time."
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
			totalPortfolioValue={formatAmount(totalPortfolioValue)}
		/>

		<!-- Positions Table -->
		<PositionTable
			{markets}
			onCalculatePnL={calculatePnL}
			onCalculateValue={calculateValue}
			{positions}
		/>

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
