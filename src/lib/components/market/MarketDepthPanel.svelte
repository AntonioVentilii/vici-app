<script lang="ts">
	import OrderBook from '$lib/components/market/OrderBook.svelte';
	import { ORDER_BOOK_POLL_MS } from '$lib/constants/app.constants';
	import { getOrderBook } from '$lib/services/order.services';
	import { orderBookStore } from '$lib/stores/order-book.store';
	import type { Market } from '$lib/types/market';
	import { formatProbability } from '$lib/utils/format.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	let selectedOutcome = $state<string>('');

	const isResolved = $derived(market.status === 'Resolved');

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

	// Drive the 5s order-book poll reactively on `isResolved`. Using `onMount`
	// left the interval running if a market transitioned Open → Resolved while
	// the panel stayed mounted (e.g. another user/admin settled the market in
	// a different tab). The effect tears the interval down the moment
	// `market.status` flips and re-establishes it if it somehow goes back to
	// open (shouldn't happen, but harmless).
	$effect(() => {
		if (isResolved) {
			return;
		}

		fetchOrderBook();
		const interval = setInterval(fetchOrderBook, ORDER_BOOK_POLL_MS);

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
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
		{#if market.payoffType === 'Binary'}
			<div class="border-yes/20 bg-yes-wash rounded-3xl border p-6">
				<div class="flex items-center justify-between">
					<span class="text-yes text-xs font-bold tracking-widest uppercase">YES Odds</span>
					<div class="bg-yes h-2 w-2 animate-pulse rounded-full"></div>
				</div>
				<div class="mt-4 flex items-baseline gap-2">
					<span class="text-foreground text-4xl font-black">
						{formatProbability(market.yesProbability)}
					</span>
					<span class="text-yes text-xs font-medium">probability</span>
				</div>
				<div class="bg-yes/20 mt-4 h-1.5 w-full rounded-full">
					<div
						style="width: {market.yesProbability * 100}%"
						class="bg-yes h-full rounded-full"
					></div>
				</div>
			</div>

			<div class="border-destructive/20 bg-destructive/10 rounded-3xl border p-6">
				<div class="flex items-center justify-between">
					<span class="text-destructive text-xs font-bold tracking-widest uppercase">NO Odds</span>
					<div class="bg-destructive h-2 w-2 animate-pulse rounded-full"></div>
				</div>
				<div class="mt-4 flex items-baseline gap-2">
					<span class="text-foreground text-4xl font-black">
						{formatProbability(market.noProbability)}
					</span>
					<span class="text-destructive text-xs font-medium">probability</span>
				</div>
				<div class="bg-destructive/20 mt-4 h-1.5 w-full rounded-full">
					<div
						style="width: {market.noProbability * 100}%"
						class="bg-destructive h-full rounded-full"
					></div>
				</div>
			</div>
		{:else}
			<div class="border-primary/20 bg-primary/10 col-span-full rounded-3xl border p-6">
				<div class="flex items-center justify-between">
					<span class="text-primary text-xs font-bold tracking-widest uppercase">
						{market.outcomes?.find((o) => o.id === selectedOutcome)?.title ?? 'Outcome'} Odds
					</span>
					<div class="bg-primary h-2 w-2 animate-pulse rounded-full"></div>
				</div>
				<div class="mt-4 flex items-baseline gap-2">
					<span class="text-foreground text-4xl font-black"> -- </span>
					<span class="text-primary text-xs font-medium">probability</span>
				</div>
				<div class="bg-primary/20 mt-4 h-1.5 w-full rounded-full">
					<div style="width: 50%" class="bg-primary h-full rounded-full"></div>
				</div>
			</div>
		{/if}
	</div>

	<div class="mt-8 flex flex-col gap-4">
		<h4 class="text-muted-foreground text-sm font-bold tracking-widest uppercase">
			Live Liquidity
		</h4>
		<div class="bg-foreground/5 flex flex-wrap gap-2 rounded-2xl p-2">
			{#if market.payoffType === 'Binary'}
				<button
					class="rounded-xl px-6 py-2 text-[10px] font-black tracking-widest uppercase transition-all {selectedOutcome ===
					'YES'
						? 'bg-card text-primary shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => (selectedOutcome = 'YES')}
				>
					Show YES
				</button>
				<button
					class="rounded-xl px-6 py-2 text-[10px] font-black tracking-widest uppercase transition-all {selectedOutcome ===
					'NO'
						? 'bg-card text-primary shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
					onclick={() => (selectedOutcome = 'NO')}
				>
					Show NO
				</button>
			{:else}
				{#each market.outcomes ?? [] as outcome (outcome.id)}
					<button
						class="rounded-xl px-4 py-2 text-[10px] font-black tracking-widest uppercase transition-all {selectedOutcome ===
						outcome.id
							? 'bg-card text-primary shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
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
