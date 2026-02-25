<script lang="ts">
	import { onMount } from 'svelte';
	import PortfolioStats from '$lib/components/portfolio/PortfolioStats.svelte';
	import PositionTable from '$lib/components/portfolio/PositionTable.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { mockBackend, type Market, type Position } from '$lib/services/mockBackend';

	let positions = $state<Position[]>([]);
	let markets = $state<Market[]>([]);
	let loading = $state(true);

	onMount(async () => {
		[positions, markets] = await Promise.all([
			mockBackend.getPositions(),
			mockBackend.getMarkets()
		]);
		loading = false;
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

	const formatAmount = (v: bigint) => (Number(v) / 100_000_000).toFixed(2);

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
		<PositionTable {calculatePnL} {calculateValue} {formatAmount} {markets} {positions} />
	{/if}
</div>
