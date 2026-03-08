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
		position: Position | undefined;
	}

	const { market, position }: Props = $props();

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
				{#if position && (position.yesAmount > ZERO || position.noAmount > ZERO)}
					<div class="rounded-2xl border border-slate-200 bg-white p-6">
						<h5 class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
							Your Active Stake
						</h5>
						<div class="mt-4 grid grid-cols-2 gap-4">
							{#if position.yesAmount > ZERO}
								<div class="flex items-center justify-between rounded-xl bg-emerald-50 p-4">
									<div>
										<span class="text-xs font-bold text-emerald-600 uppercase">YES</span>
										<div class="mt-1 text-lg font-black text-emerald-950">
											{formatToken({ value: position.yesAmount, unitName: market.token.decimals })} Units
										</div>
									</div>
								</div>
							{/if}
							{#if position.noAmount > ZERO}
								<div class="flex items-center justify-between rounded-xl bg-rose-50 p-4">
									<div>
										<span class="text-xs font-bold text-rose-600 uppercase">NO</span>
										<div class="mt-1 text-lg font-black text-rose-950">
											{formatToken({ value: position.noAmount, unitName: market.token.decimals })} Units
										</div>
									</div>
								</div>
							{/if}
						</div>
						<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
							<span class="text-xs font-medium text-slate-500">Locked Collateral</span>
							<span class="text-sm font-bold text-slate-950">
								{formatToken({ value: position.lockedCollateral, unitName: market.token.decimals })}
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
