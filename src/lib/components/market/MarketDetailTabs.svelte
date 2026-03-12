<script lang="ts">
	import MarketDepthPanel from '$lib/components/market/MarketDepthPanel.svelte';
	import MarketDiscussion from '$lib/components/social/MarketDiscussion.svelte';
	import Tabs from '$lib/components/ui/Tabs.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
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
			<div class="space-y-6">
				{#if positions.length > 0}
					<div class="rounded-2xl border border-slate-200 bg-white p-6">
						<h5 class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
							Your Active Positions
						</h5>
						<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
							{#each positions as pos (pos.marketId)}
								{#if pos.netQty !== ZERO}
									<div
										class="flex flex-col gap-2 rounded-xl p-4 {pos.outcomeId === 'YES'
											? 'bg-emerald-50'
											: pos.outcomeId === 'NO'
												? 'bg-rose-50'
												: 'bg-indigo-50'}"
									>
										<span
											class="text-[10px] font-bold tracking-widest uppercase {pos.outcomeId ===
											'YES'
												? 'text-emerald-600'
												: pos.outcomeId === 'NO'
													? 'text-rose-600'
													: 'text-indigo-600'}"
										>
											{market.outcomes?.find((o) => o.id === pos.outcomeId)?.title ?? pos.outcomeId}
										</span>
										<div
											class="text-lg font-black {pos.outcomeId === 'YES'
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
						<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
							<span class="text-xs font-medium text-slate-500">Locked Collateral</span>
							<span class="text-sm font-bold text-slate-950">
								{formatToken({
									value: positions.reduce((acc, p) => acc + p.lockedCollateral, ZERO),
									unitName: market.token.decimals
								})}
								{market.token.symbol}
							</span>
						</div>
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
