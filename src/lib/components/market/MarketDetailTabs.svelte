<script lang="ts">
	import MarketDepthPanel from '$lib/components/market/MarketDepthPanel.svelte';
	import MarketDiscussion from '$lib/components/social/MarketDiscussion.svelte';
	import Tabs from '$lib/components/ui/Tabs.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { orders } from '$lib/derived/orders.derived';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { cancelLimitOrder } from '$lib/services/order.services';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { formatToken } from '$lib/utils/format.utils';

	interface Props {
		market: Market;
		positions: Position[];
	}

	const { market, positions }: Props = $props();

	const tabOptions = [
		{ id: 'description', label: 'Description' },
		{ id: 'depth', label: 'Depth & Analytics' },
		{ id: 'discussion', label: 'Discussion' },
		{ id: 'activity', label: 'Your Activity' }
	];

	let activeTabLabel = $state(tabOptions[0].label);

	let activeTabId = $derived(
		tabOptions.find((t) => t.label === activeTabLabel)?.id ?? 'description'
	);

	const activeOrders = $derived($orders.filter((o) => o.series_id === market.id));
</script>

<div class="mt-8">
	<Tabs tabs={tabOptions.map((t) => t.label)} bind:activeTab={activeTabLabel} />

	<div class="mt-8 min-h-75">
		{#if activeTabId === 'description'}
			<div class="prose prose-slate max-w-none">
				<p class="text-lg leading-relaxed text-slate-600">
					{market.description}
				</p>
			</div>
		{:else if activeTabId === 'depth'}
			<MarketDepthPanel {market} />
		{:else if activeTabId === 'discussion'}
			<MarketDiscussion marketId={market.id} userPrincipal={$authPrincipal ?? ''} />
		{:else if activeTabId === 'activity'}
			<div class="space-y-8">
				{#if positions.length > 0 || activeOrders.length > 0}
					<!-- Positions Section -->
					{#if positions.filter((p) => p.netQty !== ZERO).length > 0}
						<div class="space-y-4">
							<h5 class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
								Your Active Positions
							</h5>
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								{#each positions as pos (pos.marketId)}
									{#if pos.netQty !== ZERO}
										<div
											class="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm {pos.outcomeId ===
											'YES'
												? 'border-emerald-100 bg-emerald-50/30'
												: pos.outcomeId === 'NO'
													? 'border-rose-100 bg-rose-50/30'
													: 'border-indigo-100 bg-indigo-50/30'}"
										>
											<span
												class="text-[10px] font-bold tracking-widest uppercase {pos.outcomeId ===
												'YES'
													? 'text-emerald-600'
													: pos.outcomeId === 'NO'
														? 'text-rose-600'
														: 'text-indigo-600'}"
											>
												{market.outcomes?.find((o) => o.id === pos.outcomeId)?.title ??
													pos.outcomeId}
											</span>
											<div
												class="text-xl font-black {pos.outcomeId === 'YES'
													? 'text-emerald-950'
													: pos.outcomeId === 'NO'
														? 'text-rose-950'
														: 'text-indigo-950'}"
											>
												{formatToken({ value: pos.netQty, unitName: market.token.decimals })} Units
											</div>
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/if}

					<!-- Active Orders Section -->
					{#if activeOrders.length > 0}
						<div class="space-y-4">
							<h5 class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
								Your Open Limit Orders
							</h5>
							<div class="flex flex-col gap-3">
								{#each activeOrders as order (order.order_id)}
									<div
										class="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
									>
										<div class="flex items-center gap-4">
											<div
												class="flex h-10 w-10 items-center justify-center rounded-xl font-black {'Buy' in
												order.side
													? 'bg-emerald-100 text-emerald-700'
													: 'bg-rose-100 text-rose-700'}"
											>
												{'Buy' in order.side ? 'B' : 'S'}
											</div>
											<div>
												<div class="text-sm font-bold text-slate-950">
													{formatToken({ value: order.qty, unitName: market.token.decimals })}
													{market.token.symbol} @ {(
														Number(order.price.decimal.value) /
														10 ** order.price.decimal.decimals
													).toFixed(2)}
												</div>
												<div class="text-[10px] font-medium text-slate-400 uppercase">
													{order.outcome_id[0] ?? 'YES'} • {'Buy' in order.side ? 'Buy' : 'Sell'}
												</div>
											</div>
										</div>
										<button
											class="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-[10px] font-bold text-rose-600 transition-all hover:bg-rose-100"
											onclick={() => cancelLimitOrder(order.order_id)}
										>
											Cancel
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<div class="flex items-center justify-between border-t border-slate-100 pt-6">
						<span class="text-xs font-medium text-slate-500">Locked Asset Capacity</span>
						<span class="text-sm font-black text-slate-950">
							{formatToken({
								value:
									positions.reduce((acc, p) => acc + p.lockedCollateral, ZERO) +
									activeOrders.reduce((acc, o) => acc + o.blocked_margin_usd, ZERO),
								unitName: 6
							})}
							vUSD
						</span>
					</div>
				{:else}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<div class="mb-4 rounded-full bg-slate-50 p-4">
							<svg
								class="h-6 w-6 text-slate-300"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
								/>
							</svg>
						</div>
						<h4 class="text-sm font-bold tracking-widest text-slate-400 uppercase">
							No Recent Activity
						</h4>
						<p class="mt-1 text-xs text-slate-400">Place a prediction to see your activity here.</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
