<script lang="ts">
	import MarketDepthPanel from '$lib/components/market/MarketDepthPanel.svelte';
	import MarketDiscussion from '$lib/components/social/MarketDiscussion.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Tabs from '$lib/components/ui/Tabs.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { orders } from '$lib/derived/orders.derived';
	import { playgroundLockedCapacityLabel } from '$lib/derived/playground.derived';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { cancelLimitOrder } from '$lib/services/order.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { decimalFixedValueToNumber, formatToken } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		market: Market;
		positions: Position[];
	}

	const { market, positions }: Props = $props();

	const tabOptions = $derived([
		{ id: 'description', label: t({ locale: $localeStore, key: 'market.detail.tab.description' }) },
		{ id: 'depth', label: t({ locale: $localeStore, key: 'market.detail.tab.depth' }) },
		{ id: 'discussion', label: t({ locale: $localeStore, key: 'market.detail.tab.discussion' }) },
		{ id: 'activity', label: t({ locale: $localeStore, key: 'market.detail.tab.activity' }) }
	]);

	let activeTabId = $state('description');

	let activeTabLabel = $derived(
		tabOptions.find((tab) => tab.id === activeTabId)?.label ?? tabOptions[0].label
	);

	const handleTabChange = (label: string) => {
		activeTabId = tabOptions.find((tab) => tab.label === label)?.id ?? 'description';
	};

	const activeOrders = $derived($orders.filter((o) => o.series_id === market.id));

	const isResolved = $derived(market.status === 'Resolved');

	const positionResult = (outcomeId: string): 'won' | 'lost' | undefined => {
		if (!isResolved || !market.outcome) {
			return;
		}

		return outcomeId === market.outcome ? 'won' : 'lost';
	};

	let cancellingId = $state<string | null>(null);

	const handleCancel = async (orderId: string) => {
		cancellingId = orderId;

		try {
			await cancelLimitOrder(orderId);
		} finally {
			cancellingId = null;
		}
	};
</script>

<div class="mt-8">
	<Tabs
		activeTab={activeTabLabel}
		onTabChange={handleTabChange}
		tabs={tabOptions.map((tab) => tab.label)}
	/>

	<div class="mt-8 min-h-75">
		{#if activeTabId === 'description'}
			<div class="prose max-w-none">
				<p class="text-muted-foreground text-lg leading-relaxed">
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
					{#if positions.filter((p) => p.netQty !== ZERO).length > 0}
						<div class="space-y-4">
							<h5 class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
								Your Active Positions
							</h5>
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
								{#each positions as pos (pos.marketId)}
									{#if pos.netQty !== ZERO}
										{@const result = positionResult(pos.outcomeId)}
										<div
											class="flex flex-col gap-2 rounded-2xl border p-5 {result === 'won'
												? 'border-yes/30 bg-yes-wash'
												: result === 'lost'
													? 'border-border bg-foreground/5 opacity-60'
													: pos.outcomeId === 'YES'
														? 'border-yes/20 bg-yes-wash/30'
														: pos.outcomeId === 'NO'
															? 'border-destructive/20 bg-destructive/5'
															: 'border-primary/20 bg-primary/5'}"
										>
											<div class="flex items-center justify-between">
												<span
													class="text-[10px] font-bold tracking-widest uppercase {result === 'won'
														? 'text-yes'
														: result === 'lost'
															? 'text-muted-foreground line-through'
															: pos.outcomeId === 'YES'
																? 'text-yes'
																: pos.outcomeId === 'NO'
																	? 'text-destructive'
																	: 'text-primary'}"
												>
													{market.outcomes?.find((o) => o.id === pos.outcomeId)?.title ??
														pos.outcomeId}
												</span>
												{#if result === 'won'}
													<span
														class="bg-yes rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest text-white uppercase"
													>
														Won
													</span>
												{:else if result === 'lost'}
													<span
														class="bg-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest text-white uppercase"
													>
														Lost
													</span>
												{/if}
											</div>
											<div
												class="text-xl font-black {result === 'won'
													? 'text-foreground'
													: result === 'lost'
														? 'text-muted-foreground line-through'
														: pos.outcomeId === 'YES'
															? 'text-foreground'
															: pos.outcomeId === 'NO'
																? 'text-foreground'
																: 'text-foreground'}"
											>
												{formatToken({ value: pos.netQty, unitName: market.token.decimals })} Units
											</div>
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/if}

					{#if activeOrders.length > 0}
						<div class="space-y-4">
							<h5 class="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
								Your Open Limit Orders
							</h5>
							<div class="flex flex-col gap-3">
								{#each activeOrders as order (order.order_id)}
									<div
										class="border-border bg-card flex items-center justify-between rounded-2xl border p-4"
									>
										<div class="flex items-center gap-4">
											<div
												class="flex h-10 w-10 items-center justify-center rounded-xl font-black {'Buy' in
												order.side
													? 'bg-yes-wash text-yes'
													: 'bg-destructive/10 text-destructive'}"
											>
												{'Buy' in order.side ? 'B' : 'S'}
											</div>
											<div>
												<div class="text-foreground text-sm font-bold">
													{formatToken({ value: order.qty, unitName: market.token.decimals })}
													{market.token.symbol} @
													{decimalFixedValueToNumber({
														value: order.price.decimal.value,
														decimals: order.price.decimal.decimals
													}).toFixed(2)}
												</div>
												<div class="text-muted-foreground text-[10px] font-medium uppercase">
													{order.outcome_id[0] ?? 'YES'} • {'Buy' in order.side ? 'Buy' : 'Sell'}
												</div>
											</div>
										</div>
										<BaseButton
											class="border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl border px-4 py-2 text-[10px] font-bold"
											onclick={() => handleCancel(order.order_id)}
											status={cancellingId === order.order_id ? 'pending' : 'enabled'}
										>
											Cancel
										</BaseButton>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<div class="border-border flex items-center justify-between border-t pt-6">
						<span class="text-muted-foreground text-xs font-medium">Locked Asset Capacity</span>
						<span class="text-foreground text-sm font-black">
							{formatToken({
								value:
									positions.reduce((acc, p) => acc + p.lockedCollateral, ZERO) +
									activeOrders.reduce((acc, o) => acc + o.blocked_margin_usd, ZERO),
								unitName: 6
							})}
							{$playgroundLockedCapacityLabel}
						</span>
					</div>
				{:else}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<div class="bg-foreground/5 mb-4 rounded-full p-4">
							<svg
								class="text-muted-foreground h-6 w-6"
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
						<h4 class="text-muted-foreground text-sm font-bold tracking-widest uppercase">
							No Recent Activity
						</h4>
						<p class="text-muted-foreground mt-1 text-xs">
							Place a prediction to see your activity here.
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
