<script lang="ts">
	import OrderBook from '$lib/components/market/OrderBook.svelte';
	import type { Market, Outcome } from '$lib/types/market';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	let selectedOutcome = $state<Outcome>('YES');

	const formatProbability = (p: number) => Math.round(p * 100);
</script>

<div class="space-y-8">
	<!-- Probability Overview -->
	<div class="grid grid-cols-2 gap-6">
		<div class="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
			<div class="flex items-center justify-between">
				<span class="text-xs font-bold tracking-widest text-emerald-600 uppercase">YES Odds</span>
				<div class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
			</div>
			<div class="mt-4 flex items-baseline gap-2">
				<span class="text-4xl font-black text-emerald-950"
					>{formatProbability(market.yesProbability)}%</span
				>
				<span class="text-xs font-medium text-emerald-600">probability</span>
			</div>
			<div class="mt-4 h-1.5 w-full rounded-full bg-emerald-100">
				<div
					style="width: {market.yesProbability * 100}%"
					class="h-full rounded-full bg-emerald-500"
				></div>
			</div>
		</div>

		<div class="rounded-3xl border border-rose-100 bg-rose-50 p-6">
			<div class="flex items-center justify-between">
				<span class="text-xs font-bold tracking-widest text-rose-600 uppercase">NO Odds</span>
				<div class="h-2 w-2 animate-pulse rounded-full bg-rose-500"></div>
			</div>
			<div class="mt-4 flex items-baseline gap-2">
				<span class="text-4xl font-black text-rose-950"
					>{formatProbability(market.noProbability)}%</span
				>
				<span class="text-xs font-medium text-rose-600">probability</span>
			</div>
			<div class="mt-4 h-1.5 w-full rounded-full bg-rose-100">
				<div
					style="width: {market.noProbability * 100}%"
					class="h-full rounded-full bg-rose-500"
				></div>
			</div>
		</div>
	</div>

	<div class="mt-8 flex items-center justify-between">
		<h4 class="text-sm font-bold tracking-widest text-slate-400 uppercase">Live Liquidity</h4>
		<div class="flex rounded-xl bg-slate-100 p-1">
			<button
				class="rounded-lg px-4 py-1.5 text-[10px] font-black tracking-widest uppercase transition-all {selectedOutcome ===
				'YES'
					? 'bg-white text-indigo-600 shadow-sm'
					: 'text-slate-500 hover:text-slate-700'}"
				onclick={() => (selectedOutcome = 'YES')}
			>
				Show YES
			</button>
			<button
				class="rounded-lg px-4 py-1.5 text-[10px] font-black tracking-widest uppercase transition-all {selectedOutcome ===
				'NO'
					? 'bg-white text-indigo-600 shadow-sm'
					: 'text-slate-500 hover:text-slate-700'}"
				onclick={() => (selectedOutcome = 'NO')}
			>
				Show NO
			</button>
		</div>
	</div>

	<OrderBook marketId={market.id} outcome={selectedOutcome} />
</div>
