<script lang="ts">
	import StatCard from '$lib/components/ui/StatCard.svelte';

	interface Props {
		totalHoldings: string;
		totalPnL: string;
		activeMarketsCount: number;
		pnlVariant: 'success' | 'warning' | 'default';
	}

	const { totalHoldings, totalPnL, activeMarketsCount, pnlVariant }: Props = $props();
</script>

<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
	<StatCard label="Total Holdings" value={totalHoldings} />

	<StatCard label="Unrealized P&L" value={totalPnL} variant={pnlVariant} />

	<StatCard label="Active Markets" value={activeMarketsCount} />
</div>
