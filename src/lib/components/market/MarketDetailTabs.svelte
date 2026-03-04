<script lang="ts">
	import MarketDepthPanel from '$lib/components/market/MarketDepthPanel.svelte';
	import MarketDiscussion from '$lib/components/social/MarketDiscussion.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';

	interface Props {
		market: Market;
		position: Position | undefined;
	}

	const { market, position }: Props = $props();

	let activeTab = $state('description');

	const tabs = [
		{ id: 'description', label: 'Description' },
		{ id: 'depth', label: 'Depth & Analytics' },
		{ id: 'discussion', label: 'Discussion' },
		{ id: 'activity', label: 'Your Activity' }
	];
</script>

<div class="mt-8">
	<div class="flex border-b border-slate-200">
		{#each tabs as tab (tab.id)}
			<button
				class="relative px-6 py-4 text-sm font-bold tracking-widest uppercase transition-all {activeTab ===
				tab.id
					? 'text-indigo-600'
					: 'text-slate-400 hover:text-slate-600'}"
				onclick={() => {
					activeTab = tab.id;
				}}
			>
				{tab.label}
				{#if activeTab === tab.id}
					<div class="absolute bottom-0 left-0 h-1 w-full rounded-t-full bg-indigo-600"></div>
				{/if}
			</button>
		{/each}
	</div>

	<div class="mt-8 min-h-75">
		{#if activeTab === 'description'}
			<div class="prose prose-slate max-w-none">
				<p class="text-lg leading-relaxed text-slate-600">
					{market.description}
				</p>
			</div>
		{:else if activeTab === 'depth'}
			<MarketDepthPanel {market} />
		{:else if activeTab === 'discussion'}
			<MarketDiscussion marketId={market.id} userPrincipal={$authPrincipal ?? ''} />
		{:else if activeTab === 'activity'}
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
											{(Number(position.yesAmount) / 100_000_000).toFixed(2)} Units
										</div>
									</div>
								</div>
							{/if}
							{#if position.noAmount > ZERO}
								<div class="flex items-center justify-between rounded-xl bg-rose-50 p-4">
									<div>
										<span class="text-xs font-bold text-rose-600 uppercase">NO</span>
										<div class="mt-1 text-lg font-black text-rose-950">
											{(Number(position.noAmount) / 100_000_000).toFixed(2)} Units
										</div>
									</div>
								</div>
							{/if}
						</div>
						<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
							<span class="text-xs font-medium text-slate-500">Locked Collateral</span>
							<span class="text-sm font-bold text-slate-950">
								{(Number(position.lockedCollateral) / 100_000_000).toFixed(8)} ICP
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
