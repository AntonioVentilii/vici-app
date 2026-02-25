<script lang="ts">
	import StatCard from '$lib/components/ui/StatCard.svelte';

	interface Props {
		totalPortfolioValue: string;
		totalPnL: number;
		activeMarketsCount: number;
	}

	const { totalPortfolioValue, totalPnL, activeMarketsCount }: Props = $props();
</script>

<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
	<StatCard label="Total Holdings" unit="ICP" value={totalPortfolioValue} />

	<StatCard
		label="Unrealized P&L"
		unit="ICP"
		value={(totalPnL >= 0 ? '+' : '') + totalPnL.toFixed(2)}
		valueClass={totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}
	/>

	<StatCard label="Active Markets" value={activeMarketsCount} />
</div>
