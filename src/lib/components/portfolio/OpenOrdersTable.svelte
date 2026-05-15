<script lang="ts">
	import type { ClearingDid } from '$declarations';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { PORTFOLIO_DEFAULT_DECIMALS } from '$lib/constants/portfolio.constants';
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
	<h2 class="text-foreground text-xl font-bold tracking-wider uppercase">Open Orders</h2>
	<Card class="overflow-hidden" padding="none">
		{#if orders.length === 0}
			<EmptyState message="No open orders found." />
		{:else}
			<div class="flex w-full min-w-0 overflow-x-auto">
				<table class="w-full min-w-0 table-fixed text-left">
					<thead>
						<tr
							class="border-border bg-foreground/5 text-muted-foreground border-b text-[10px] tracking-widest uppercase"
						>
							<th class="px-6 py-4 font-black">Market</th>
							<th class="px-6 py-4 font-black">Side</th>
							<th class="px-6 py-4 text-right font-black">Price</th>
							<th class="px-6 py-4 text-right font-black">Qty</th>
							<th class="px-6 py-4 text-right font-black">Action</th>
						</tr>
					</thead>
					<tbody class="divide-border divide-y">
						{#each orders as order (order.order_id)}
							{@const market = getMarketById(order.series_id)}
							{@const isBuy = isBuyOrder(order)}

							<tr class="group hover:bg-foreground/5 transition-colors">
								<td class="min-w-0 px-6 py-4">
									<div class="flex min-w-0 flex-col">
										<span class="text-foreground block truncate text-sm font-bold">
											{market?.title ?? 'Unknown Market'}
										</span>
										<span class="text-muted-foreground truncate text-[10px] uppercase"
											>ID: {order.series_id}</span
										>
									</div>
								</td>
								<td class="px-6 py-4">
									<span
										class="rounded-md border px-1.5 py-0.5 text-[10px] font-black tracking-tight uppercase {isBuy
											? 'border-success/20 bg-success/10 text-success'
											: 'border-destructive/20 bg-destructive/10 text-destructive'}"
									>
										{isBuy ? 'BUY' : 'SELL'}
									</span>
								</td>
								<td class="text-foreground px-6 py-4 text-right text-sm font-bold">
									{formatPrice(order.price)}
								</td>
								<td class="text-foreground px-6 py-4 text-right text-sm font-bold">
									{formatQuantity({
										value: order.qty,
										decimals: market?.token.decimals ?? PORTFOLIO_DEFAULT_DECIMALS
									})}
								</td>
								<td class="px-6 py-4 text-right">
									<BaseButton
										class="bg-destructive/10 text-destructive hover:bg-destructive/15 rounded-lg px-3 py-1 text-[10px] font-bold"
										onclick={() => handleCancel(order.order_id)}
										status={cancellingId === order.order_id ? 'pending' : 'enabled'}
									>
										Cancel
									</BaseButton>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</div>
