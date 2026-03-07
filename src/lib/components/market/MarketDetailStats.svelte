<script lang="ts">
	import type { Market } from '$lib/types/market';
	import { formatToken } from '$lib/utils/format.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	const {
		totalVolume,
		expiryDate,
		token: { symbol: tokenSymbol, decimals: tokenDecimals }
	} = $derived(market);

	const getTimeRemaining = (expiry: bigint) => {
		const now = BigInt(Date.now());

		const diff = Number(expiry - now);

		if (diff <= 0) {
			return 'Expired';
		}

		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

		if (days > 0) {
			return `${days}d ${hours}h ${minutes}m`;
		}
		return `${hours}h ${minutes}m remaining`;
	};

	const timeRemaining = $derived(getTimeRemaining(market.expiryDate));
</script>

<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
	<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Total Volume</div>
		<div class="mt-1 text-xl font-black text-slate-950">
			{formatToken({ value: totalVolume, unitName: tokenDecimals })}
			{tokenSymbol}
		</div>
	</div>
	<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Expiry Date</div>
		<div class="mt-1 text-xl font-black text-slate-950">
			{new Date(Number(expiryDate)).toLocaleDateString()}
		</div>
	</div>
	<div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
		<div class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Time Remaining</div>
		<div class="mt-1 text-xl font-black text-indigo-600">
			{timeRemaining}
		</div>
	</div>
</div>
