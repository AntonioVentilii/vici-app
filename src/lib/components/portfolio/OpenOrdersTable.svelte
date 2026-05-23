<script lang="ts">
	import type { ClearingDid } from '$declarations';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import {
		PORTFOLIO_DEFAULT_DECIMALS,
		PORTFOLIO_PAGE_SIZE
	} from '$lib/constants/portfolio.constants';
	import { cancelLimitOrder } from '$lib/services/order.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { formatPrice, formatQuantity } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		orders: ClearingDid.LimitOrder[];
		markets: Market[];
		onRefresh: () => void;
	}

	const { orders, markets, onRefresh }: Props = $props();

	const getMarketById = (id: string) => markets.find((m) => m.id === id);

	const isBuyOrder = (order: ClearingDid.LimitOrder) => 'Buy' in order.side;

	let cancellingId = $state<string | null>(null);

	let page = $state(1);

	$effect(() => {
		const totalPages = Math.max(1, Math.ceil(orders.length / PORTFOLIO_PAGE_SIZE));

		if (page > totalPages) {
			page = totalPages;
		}
	});

	const pagedOrders = $derived(
		orders.slice((page - 1) * PORTFOLIO_PAGE_SIZE, page * PORTFOLIO_PAGE_SIZE)
	);

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
	<h2 class="text-foreground text-xl font-bold tracking-wider uppercase">
		{t({ locale: $localeStore, key: 'portfolio.orders.title' })}
	</h2>
	<Card class="overflow-hidden" padding="none">
		{#if orders.length === 0}
			<EmptyState message={t({ locale: $localeStore, key: 'portfolio.orders.empty' })} />
		{:else}
			<!-- Mobile: stacked card list -->
			<ul class="divide-border block divide-y md:hidden">
				{#each pagedOrders as order (order.order_id)}
					{@const market = getMarketById(order.series_id)}
					{@const isBuy = isBuyOrder(order)}

					<li class="px-4 py-4">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="text-foreground line-clamp-2 text-sm leading-snug font-bold">
									{market?.title ?? t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
								</p>
								<p
									class="text-muted-foreground mt-1 truncate text-[10px] tracking-widest uppercase"
								>
									{t({
										locale: $localeStore,
										key: 'portfolio.id_label',
										params: { id: order.series_id }
									})}
								</p>
							</div>
							<span
								class="shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-black tracking-tight uppercase {isBuy
									? 'border-success/20 bg-success/10 text-success'
									: 'border-destructive/20 bg-destructive/10 text-destructive'}"
							>
								{isBuy
									? t({ locale: $localeStore, key: 'portfolio.orders.side.buy' })
									: t({ locale: $localeStore, key: 'portfolio.orders.side.sell' })}
							</span>
						</div>

						<div class="border-border mt-3 flex items-end justify-between gap-3 border-t pt-3">
							<dl class="grid flex-1 grid-cols-2 gap-2">
								<div>
									<dt class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
										{t({ locale: $localeStore, key: 'portfolio.orders.col.price' })}
									</dt>
									<dd class="text-foreground mt-1 font-mono text-sm font-bold tabular-nums">
										{formatPrice(order.price)}
									</dd>
								</div>
								<div>
									<dt class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
										{t({ locale: $localeStore, key: 'portfolio.orders.col.qty' })}
									</dt>
									<dd class="text-foreground mt-1 font-mono text-sm font-bold tabular-nums">
										{formatQuantity({
											value: order.qty,
											decimals: market?.token.decimals ?? PORTFOLIO_DEFAULT_DECIMALS
										})}
									</dd>
								</div>
							</dl>
							<BaseButton
								class="bg-destructive/10 text-destructive hover:bg-destructive/15 shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-bold"
								onclick={() => handleCancel(order.order_id)}
								status={cancellingId === order.order_id ? 'pending' : 'enabled'}
							>
								{t({ locale: $localeStore, key: 'profile.dashboard.cancel' })}
							</BaseButton>
						</div>
					</li>
				{/each}
			</ul>

			<!-- Desktop: full table -->
			<div class="hidden w-full min-w-0 overflow-x-auto md:flex">
				<table class="w-full min-w-0 table-fixed text-left">
					<thead>
						<tr
							class="border-border bg-foreground/5 text-muted-foreground border-b text-[10px] tracking-widest uppercase"
						>
							<th class="px-6 py-4 font-black"
								>{t({ locale: $localeStore, key: 'portfolio.orders.col.market' })}</th
							>
							<th class="px-6 py-4 font-black"
								>{t({ locale: $localeStore, key: 'portfolio.orders.col.side' })}</th
							>
							<th class="px-6 py-4 text-right font-black"
								>{t({ locale: $localeStore, key: 'portfolio.orders.col.price' })}</th
							>
							<th class="px-6 py-4 text-right font-black"
								>{t({ locale: $localeStore, key: 'portfolio.orders.col.qty' })}</th
							>
							<th class="px-6 py-4 text-right font-black"
								>{t({ locale: $localeStore, key: 'portfolio.orders.col.action' })}</th
							>
						</tr>
					</thead>
					<tbody class="divide-border divide-y">
						{#each pagedOrders as order (order.order_id)}
							{@const market = getMarketById(order.series_id)}
							{@const isBuy = isBuyOrder(order)}

							<tr class="group hover:bg-foreground/5 transition-colors">
								<td class="min-w-0 px-6 py-4">
									<div class="flex min-w-0 flex-col">
										<span class="text-foreground block truncate text-sm font-bold">
											{market?.title ??
												t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
										</span>
										<span class="text-muted-foreground truncate text-[10px] uppercase"
											>{t({
												locale: $localeStore,
												key: 'portfolio.id_label',
												params: { id: order.series_id }
											})}</span
										>
									</div>
								</td>
								<td class="px-6 py-4">
									<span
										class="rounded-md border px-1.5 py-0.5 text-[10px] font-black tracking-tight uppercase {isBuy
											? 'border-success/20 bg-success/10 text-success'
											: 'border-destructive/20 bg-destructive/10 text-destructive'}"
									>
										{isBuy
											? t({ locale: $localeStore, key: 'portfolio.orders.side.buy' })
											: t({ locale: $localeStore, key: 'portfolio.orders.side.sell' })}
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
										{t({ locale: $localeStore, key: 'profile.dashboard.cancel' })}
									</BaseButton>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<Pagination
				onPageChange={(p) => (page = p)}
				{page}
				pageSize={PORTFOLIO_PAGE_SIZE}
				totalItems={orders.length}
			/>
		{/if}
	</Card>
</div>
