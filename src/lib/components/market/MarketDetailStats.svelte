<script lang="ts">
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import type { Market } from '$lib/types/market';
	import { formatDate, formatVolume } from '$lib/utils/format.utils';
	import { getTimeRemaining } from '$lib/utils/market.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	const {
		totalVolume,
		expiryDate,
		token: { symbol: tokenSymbol, decimals: tokenDecimals }
	} = $derived(market);

	const timeRemaining = $derived(getTimeRemaining(market.expiryDate));
</script>

<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
	<StatCard
		label="Total Volume"
		unit={tokenSymbol}
		value={formatVolume({ volume: totalVolume, decimals: tokenDecimals, symbol: '' })}
	/>
	<StatCard label="Expiry Date" value={formatDate(expiryDate)} />
	<StatCard label="Time Remaining" value={timeRemaining} variant="primary" />
</div>
