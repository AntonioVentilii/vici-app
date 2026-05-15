<script lang="ts">
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

<div class="border-border flex flex-wrap justify-center gap-6 border-y py-6">
	<div class="flex flex-col items-center">
		<span class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase"
			>Total Volume</span
		>
		<div class="mt-1 flex items-baseline gap-1">
			<span class="text-foreground font-mono text-xl font-black tabular-nums">
				{formatVolume({ volume: totalVolume, decimals: tokenDecimals, symbol: '' })}
			</span>
			<span class="text-muted-foreground text-xs font-bold">{tokenSymbol}</span>
		</div>
	</div>
	<div class="bg-border h-10 w-px"></div>
	<div class="flex flex-col items-center">
		<span class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase"
			>Expiry Date</span
		>
		<span class="text-foreground mt-1 text-xl font-black">{formatDate(expiryDate)}</span>
	</div>
	<div class="bg-border h-10 w-px"></div>
	<div class="flex flex-col items-center">
		<span class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
			Time Remaining
		</span>
		<span class="text-primary mt-1 text-xl font-black">{timeRemaining}</span>
	</div>
</div>
