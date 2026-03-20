<script lang="ts">
	import { onMount } from 'svelte';
	import OrderBook from '$lib/components/market/OrderBook.svelte';
	import { getOrderBook } from '$lib/services/order.services';
	import { orderBookStore } from '$lib/stores/order-book.store';
	import type { Market } from '$lib/types/market';
	import { formatProbability } from '$lib/utils/format.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	let selectedOutcome = $state<string>('');

	const fetchOrderBook = async () => {
		try {
			const orders = await getOrderBook({
				marketId: market.id,
				domain: market.balanceDomain
			});

			orderBookStore.update((state) => ({
				...state,
				[market.id]: orders
			}));
		} catch (err) {
			console.error('Failed to fetch order book in depth panel', err);
		}
	};

	onMount(() => {
		fetchOrderBook();
		const interval = setInterval(fetchOrderBook, 5_000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (selectedOutcome === '') {
			selectedOutcome =
				market.payoffType === 'Categorical' ? (market.outcomes?.[0]?.id ?? 'YES') : 'YES';
		}
	});
</script>

<div class="space-y-8">
	<!-- Probability Overview -->
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
		{#if market.payoffType === 'Binary'}
			<div class="rounded-3xl border border-emerald-100 bg-emerald-50 p-6">
				<div class="flex items-center justify-between">
					<span class="text-xs font-bold tracking-widest text-emerald-600 uppercase">YES Odds</span>
					<div class="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
				</div>
				<div class="mt-4 flex items-baseline gap-2">
					<span class="text-4xl font-black text-emerald-950">
						{formatProbability(market.yesProbability)}
					</span>
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
					<span class="text-4xl font-black text-rose-950">
						{formatProbability(market.noProbability)}
					</span>
					<span class="text-xs font-medium text-rose-600">probability</span>
				</div>
				<div class="mt-4 h-1.5 w-full rounded-full bg-rose-100">
					<div
						style="width: {market.noProbability * 100}%"
						class="h-full rounded-full bg-rose-500"
					></div>
				</div>
			</div>
		{:else}
			<div class="col-span-full rounded-3xl border border-indigo-100 bg-indigo-50 p-6">
				<div class="flex items-center justify-between">
					<span class="text-xs font-bold tracking-widest text-indigo-600 uppercase"
						>{market.outcomes?.find((o) => o.id === selectedOutcome)?.title ?? 'Outcome'} Odds</span
					>
					<div class="h-2 w-2 animate-pulse rounded-full bg-indigo-500"></div>
				</div>
				<div class="mt-4 flex items-baseline gap-2">
					<span class="text-4xl font-black text-indigo-950"> -- </span>
					<span class="text-xs font-medium text-indigo-600">probability</span>
				</div>
				<div class="mt-4 h-1.5 w-full rounded-full bg-indigo-100">
					<div style="width: 50%" class="h-full rounded-full bg-indigo-500"></div>
				</div>
			</div>
		{/if}
	</div>

	<div class="mt-8 flex flex-col gap-4">
		<h4 class="text-sm font-bold tracking-widest text-slate-400 uppercase">Live Liquidity</h4>
		<div class="flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-2">
			{#if market.payoffType === 'Binary'}
				<button
					class="rounded-xl px-6 py-2 text-[10px] font-black tracking-widest uppercase transition-all {selectedOutcome ===
					'YES'
						? 'bg-white text-indigo-600 shadow-sm'
						: 'text-slate-500 hover:text-slate-700'}"
					onclick={() => (selectedOutcome = 'YES')}
				>
					Show YES
				</button>
				<button
					class="rounded-xl px-6 py-2 text-[10px] font-black tracking-widest uppercase transition-all {selectedOutcome ===
					'NO'
						? 'bg-white text-indigo-600 shadow-sm'
						: 'text-slate-500 hover:text-slate-700'}"
					onclick={() => (selectedOutcome = 'NO')}
				>
					Show NO
				</button>
			{:else}
				{#each market.outcomes ?? [] as outcome (outcome.id)}
					<button
						class="rounded-xl px-4 py-2 text-[10px] font-black tracking-widest uppercase transition-all {selectedOutcome ===
						outcome.id
							? 'bg-white text-indigo-600 shadow-sm'
							: 'text-slate-500 hover:text-slate-700'}"
						onclick={() => (selectedOutcome = outcome.id)}
					>
						{outcome.title}
					</button>
				{/each}
			{/if}
		</div>
	</div>

	<OrderBook {market} outcome={selectedOutcome} />
</div>
