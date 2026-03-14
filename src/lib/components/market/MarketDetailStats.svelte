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

<div class="flex flex-wrap justify-center gap-6 border-y border-slate-100 py-6">
	<div class="flex flex-col items-center">
		<span class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Total Volume</span>
		<div class="mt-1 flex items-baseline gap-1">
			<span class="text-xl font-black text-slate-950"
				>{formatVolume({ volume: totalVolume, decimals: tokenDecimals, symbol: '' })}</span
			>
			<span class="text-xs font-bold text-slate-400">{tokenSymbol}</span>
		</div>
	</div>
	<div class="h-10 w-px bg-slate-100"></div>
	<div class="flex flex-col items-center">
		<span class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Expiry Date</span>
		<span class="mt-1 text-xl font-black text-slate-950">{formatDate(expiryDate)}</span>
	</div>
	<div class="h-10 w-px bg-slate-100"></div>
	<div class="flex flex-col items-center">
		<span class="text-[10px] font-bold tracking-widest text-slate-500 uppercase"
			>Time Remaining</span
		>
		<span class="mt-1 text-xl font-black text-indigo-600">{timeRemaining}</span>
	</div>
</div>
