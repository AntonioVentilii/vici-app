<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import { ZERO } from '$lib/constants/app.constants';
	import { orders } from '$lib/derived/orders.derived';
	import { orderBookStore } from '$lib/stores/order-book.store';
	import { selectPrice } from '$lib/stores/trade.store';
	import type { Market, Outcome } from '$lib/types/market';
	import type { OrderBookLevel } from '$lib/types/order';
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

	let outcomeChanging = $state(false);

	$effect(() => {
		if (outcome) {
			outcomeChanging = true;
			const timer = setTimeout(() => (outcomeChanging = false), 300);
			return () => clearTimeout(timer);
		}
	});

	const rawOrders = $derived($orderBookStore?.[marketId]);
	const loading = $derived(isNullish(rawOrders) || outcomeChanging);

	const processedBook = $derived(() => {
		if (!rawOrders) {
			return { bids: [], asks: [] };
		}

		const bids: OrderBookLevel[] = [];
		const asks: OrderBookLevel[] = [];

		rawOrders.forEach((o) => {
			const side = 'Buy' in o.side ? 'BUY' : 'SELL';
			const oOutcomeId = o.outcome_id[0] ?? 'YES';

			const isBinarySide = outcome === 'YES' || outcome === 'NO';
			const isOrderBinarySide = oOutcomeId === 'YES' || oOutcomeId === 'NO';

			let displaySide = side;
			let displayPrice = Number(o.price.decimal.value) / 10 ** o.price.decimal.decimals;

			if (oOutcomeId !== outcome) {
				if (isBinarySide && isOrderBinarySide) {
					displaySide = side === 'BUY' ? 'SELL' : 'BUY';
					displayPrice = 1 - displayPrice;
				} else {
					return;
				}
			}

			const target = displaySide === 'BUY' ? bids : asks;
			const existing = target.find((l) => Math.abs(l.price - displayPrice) < 0.000001);

			if (nonNullish(existing)) {
				existing.totalQty += o.qty;
				existing.orderCount += 1;
			} else {
				target.push({
					price: displayPrice,
					totalQty: o.qty,
					orderCount: 1
				});
			}
		});

		return {
			bids: bids.sort((a, b) => b.price - a.price),
			asks: asks.sort((a, b) => a.price - b.price)
		};
	});

	const displayBids = $derived(processedBook().bids);
	const displayAsks = $derived(processedBook().asks);

	const calculateDepthPercentage = ({ qty, maxQty }: { qty: bigint; maxQty: bigint }) => {
		if (maxQty === ZERO) {
			return 0;
		}
		return (Number(qty) / Number(maxQty)) * 100;
	};

	const maxQty = $derived(() => {
		const allLevels = [...displayBids, ...displayAsks];
		return allLevels.reduce((max, level) => (level.totalQty > max ? level.totalQty : max), ZERO);
	});

	const handlePriceSelect = (price: number) => {
		selectPrice(price);
	};

	const isUserLevel = $derived((price: number) =>
		$orders.some((o) => {
			if (o.series_id !== marketId) {
				return false;
			}

			const oOutcomeId = o.outcome_id[0] ?? 'YES';
			const oPrice = Number(o.price.decimal.value) / 10 ** o.price.decimal.decimals;

			if (oOutcomeId === outcome) {
				return Math.abs(oPrice - price) < 0.000001;
			}

			if (
				(outcome === 'YES' || outcome === 'NO') &&
				(oOutcomeId === 'YES' || oOutcomeId === 'NO')
			) {
				return Math.abs(1 - oPrice - price) < 0.000001;
			}

			return false;
		})
	);
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
		<div class="flex flex-col items-center justify-center py-20">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600"
			></div>
			<span class="mt-4 text-[10px] font-bold tracking-widest text-indigo-600 uppercase"
				>Updating Depth...</span
			>
		</div>
	{:else}
		<div class="space-y-1">
			<!-- Asks (Sells) -->
			<div class="flex flex-col-reverse">
				{#each displayAsks as ask (ask.price)}
					<button
						class="group relative flex items-center justify-between overflow-hidden rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 {isUserLevel(
							ask.price
						)
							? 'bg-slate-50/50 ring-1 ring-slate-200 ring-inset'
							: ''}"
						onclick={() => handlePriceSelect(ask.price)}
					>
						<!-- Depth Bar -->
						<div
							style="width: {calculateDepthPercentage({ qty: ask.totalQty, maxQty: maxQty() })}%"
							class="absolute inset-y-0 right-0 bg-red-500/5 transition-all group-hover:bg-red-500/10"
						></div>

						<span class="relative z-10 text-sm font-bold text-red-500">
							{formatProbability(ask.price)}
							{#if isUserLevel(ask.price)}
								<span class="ml-1 inline-block h-1 w-1 rounded-full bg-red-400 align-middle"></span>
							{/if}
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
						class="group relative flex items-center justify-between overflow-hidden rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 {isUserLevel(
							bid.price
						)
							? 'bg-slate-50/50 ring-1 ring-slate-200 ring-inset'
							: ''}"
						onclick={() => handlePriceSelect(bid.price)}
					>
						<!-- Depth Bar -->
						<div
							style="width: {calculateDepthPercentage({ qty: bid.totalQty, maxQty: maxQty() })}%"
							class="absolute inset-y-0 right-0 bg-green-500/5 transition-all group-hover:bg-green-500/10"
						></div>

						<span class="relative z-10 text-sm font-bold text-green-500">
							{formatProbability(bid.price)}
							{#if isUserLevel(bid.price)}
								<span class="ml-1 inline-block h-1 w-1 rounded-full bg-green-400 align-middle"
								></span>
							{/if}
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
