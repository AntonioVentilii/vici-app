<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import { ZERO } from '$lib/constants/app.constants';
	import { orderBookStore } from '$lib/stores/order-book.store';
	import { selectPrice } from '$lib/stores/trade.store';
	import type { Market, Outcome } from '$lib/types/market';
	import { formatProbability, formatQuantity } from '$lib/utils/format.utils';

	interface Props {
		market: Market;
		outcome?: Outcome;
	}

	const { market, outcome = 'YES' }: Props = $props();

	const {
		id: marketId,
		token: { decimals: tokenDecimals }
	} = $derived(market);

	let orderBook = $derived($orderBookStore?.[marketId]);

	let loading = $derived(isNullish(orderBook));

	const calculateDepthPercentage = ({ qty, maxQty }: { qty: bigint; maxQty: bigint }) => {
		if (maxQty === ZERO) {
			return 0;
		}
		return (Number(qty) / Number(maxQty)) * 100;
	};

	const displayBids = $derived(orderBook?.bids ?? []);
	const displayAsks = $derived(orderBook?.asks ?? []);

	const maxQty = $derived(() => {
		if (!orderBook) {
			return ZERO;
		}
		const allLevels = [...orderBook.bids, ...orderBook.asks];
		return allLevels.reduce((max, level) => (level.totalQty > max ? level.totalQty : max), ZERO);
	});

	const handlePriceSelect = (price: number) => {
		// If we are looking at NO, the selected price needs to be flipped back to YES for the store
		// OR we let the store handle it? Actually, PredictionInterface expects the price as displayed.
		selectPrice(price);
	};
</script>

<div class="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
	<div class="mb-6 flex items-center justify-between">
		<h3 class="text-lg font-bold text-slate-950">Order Book ({outcome})</h3>
		<div class="flex items-center gap-2">
			<span class="flex h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
			<span class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Live</span>
		</div>
	</div>

	{#if loading}
		<div class="flex h-48 items-center justify-center">
			<div
				class="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
			></div>
		</div>
	{:else if orderBook}
		<div class="space-y-1">
			<!-- Asks (Sells) -->
			<div class="flex flex-col-reverse">
				{#each displayAsks as ask (ask.price)}
					<button
						class="group relative flex items-center justify-between overflow-hidden rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
						onclick={() => handlePriceSelect(ask.price)}
					>
						<!-- Depth Bar -->
						<div
							style="width: {calculateDepthPercentage({ qty: ask.totalQty, maxQty: maxQty() })}%"
							class="absolute inset-y-0 right-0 bg-red-500/5 transition-all group-hover:bg-red-500/10"
						></div>

						<span class="relative z-10 text-sm font-bold text-red-500">
							{formatProbability(ask.price)}
						</span>
						<span class="relative z-10 text-xs font-medium text-slate-500">
							{formatQuantity({ value: ask.totalQty, decimals: tokenDecimals })}
						</span>
					</button>
				{/each}
			</div>

			<!-- Spread -->
			<div class="flex items-center justify-between border-y border-slate-100 px-2 py-4">
				<span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">Spread</span>
				{#if displayAsks.length > 0 && displayBids.length > 0}
					<span class="text-xs font-bold text-slate-600">
						{formatProbability(Math.abs(displayAsks[0].price - displayBids[0].price))}
					</span>
				{/if}
			</div>

			<!-- Bids (Buys) -->
			<div class="flex flex-col">
				{#each displayBids as bid (bid.price)}
					<button
						class="group relative flex items-center justify-between overflow-hidden rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
						onclick={() => handlePriceSelect(bid.price)}
					>
						<!-- Depth Bar -->
						<div
							style="width: {calculateDepthPercentage({ qty: bid.totalQty, maxQty: maxQty() })}%"
							class="absolute inset-y-0 right-0 bg-green-500/5 transition-all group-hover:bg-green-500/10"
						></div>

						<span class="relative z-10 text-sm font-bold text-green-500">
							{formatProbability(bid.price)}
						</span>
						<span class="relative z-10 text-xs font-medium text-slate-500">
							{formatQuantity({ value: bid.totalQty, decimals: tokenDecimals })}
						</span>
					</button>
				{/each}
			</div>
		</div>

		<div
			class="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-[10px] font-bold tracking-widest text-slate-400 uppercase"
		>
			<div>Price</div>
			<div class="text-right">Qty</div>
		</div>
	{/if}
</div>
