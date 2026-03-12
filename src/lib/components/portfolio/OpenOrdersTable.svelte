<script lang="ts">
	import type { ClearingDid } from '$declarations';
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { cancelLimitOrder } from '$lib/services/order.services';
	import type { Market } from '$lib/types/market';
	import { formatPrice, formatQuantity } from '$lib/utils/format.utils';

	interface Props {
		orders: ClearingDid.LimitOrder[];
		markets: Market[];
		onRefresh: () => void;
	}

	const { orders, markets, onRefresh }: Props = $props();

	const getMarketById = (id: string) => markets.find((m) => m.id === id);

	const isBuyOrder = (order: ClearingDid.LimitOrder) => 'Buy' in order.side;

	let cancellingId = $state<string | null>(null);

	const handleCancel = async (orderId: string) => {
		cancellingId = orderId;
		try {
			await cancelLimitOrder(orderId);
			onRefresh();
		} finally {
			cancellingId = null;
		}
	};
</script>

<div class="space-y-4">
	<h2 class="text-xl font-bold tracking-wider text-slate-950 uppercase">Open Orders</h2>
	<Card padding="none">
		{#if orders.length === 0}
			<EmptyState message="No open orders found." />
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-left">
					<thead>
						<tr
							class="border-b border-slate-100 bg-slate-50 text-[10px] tracking-widest text-slate-500 uppercase"
						>
							<th class="px-6 py-4 font-black">Market</th>
							<th class="px-6 py-4 font-black">Side</th>
							<th class="px-6 py-4 text-right font-black">Price</th>
							<th class="px-6 py-4 text-right font-black">Qty</th>
							<th class="px-6 py-4 text-right font-black">Action</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each orders as order (order.order_id)}
							{@const market = getMarketById(order.series_id)}
							{@const isBuy = isBuyOrder(order)}

							<tr class="group transition-colors hover:bg-slate-50">
								<td class="px-6 py-4">
									<div class="flex flex-col">
										<span class="text-sm font-bold text-slate-950">
											{market?.title ?? 'Unknown Market'}
										</span>
										<span class="text-[10px] text-slate-400 uppercase">ID: {order.series_id}</span>
									</div>
								</td>
								<td class="px-6 py-4">
									<span
										class="rounded-md border px-1.5 py-0.5 text-[10px] font-black tracking-tight uppercase {isBuy
											? 'border-green-200 bg-green-50 text-green-700'
											: 'border-red-200 bg-red-50 text-red-700'}"
									>
										{isBuy ? 'BUY' : 'SELL'}
									</span>
								</td>
								<td class="px-6 py-4 text-right text-sm font-bold text-slate-950">
									{formatPrice(order.price)}
								</td>
								<td class="px-6 py-4 text-right text-sm font-bold text-slate-950">
									{formatQuantity({ value: order.qty, decimals: market?.token.decimals ?? 8 })}
								</td>
								<td class="px-6 py-4 text-right">
									<button
										class="rounded-lg bg-red-50 px-3 py-1 text-[10px] font-bold text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
										disabled={cancellingId === order.order_id}
										onclick={() => handleCancel(order.order_id)}
									>
										{cancellingId === order.order_id ? '...' : 'Cancel'}
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>
