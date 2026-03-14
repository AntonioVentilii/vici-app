<script lang="ts">
	import MarketRecentTrades from '$lib/components/market/MarketRecentTrades.svelte';
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import type { Market } from '$lib/types/market';
	import { formatCurrency } from '$lib/utils/format.utils';
	import { getTimeRemaining } from '$lib/utils/market.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	let selectedTab = $state<'Odds' | 'History' | 'Rules'>('Odds');

	const timeRemaining = $derived(getTimeRemaining(market.expiryDate));
</script>

<div class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
	<!-- Tab-like Header -->
	<div class="flex border-b border-slate-100 bg-slate-50/50">
		{#each ['Odds', 'History', 'Rules'] as tab (tab)}
			<button
				class="flex-1 px-4 py-3 text-xs font-bold transition-all {selectedTab === tab
					? 'border-b-2 border-indigo-600 text-indigo-600'
					: 'text-slate-400 hover:text-slate-600'}"
				onclick={() => (selectedTab = tab as typeof selectedTab)}
			>
				{tab}
			</button>
		{/each}
	</div>

	<div class="min-h-[300px] p-6">
		{#if selectedTab === 'Odds'}
			<div class="space-y-6">
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-slate-500">Status</span>
						<OutcomeBadge status={market.status} />
					</div>

					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-slate-500">Total Pool</span>
						<div class="flex items-center gap-1.5">
							<span class="font-black text-slate-900">
								{formatCurrency({ value: market.totalVolume, decimals: market.token.decimals })}
							</span>
							<span class="text-xs font-bold text-slate-400">{market.token.symbol}</span>
						</div>
					</div>

					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-slate-500">Time Left</span>
						<span class="font-mono text-sm font-bold text-indigo-600">{timeRemaining}</span>
					</div>

					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-slate-500">Total Predictions</span>
						<span class="font-black text-slate-900"
							>{market.outcomes?.reduce((acc, o) => acc + (o.totalPredictions ?? 0), 0) ?? 0}</span
						>
					</div>
				</div>
			</div>
		{:else if selectedTab === 'History'}
			<div class="-m-6">
				<MarketRecentTrades isEmbedded={true} marketId={market.id} />
			</div>
		{:else}
			<div class="space-y-4">
				<h4 class="text-xs font-black tracking-widest text-slate-400 uppercase">Description</h4>
				<p class="text-sm leading-relaxed text-slate-600">
					{market.description || 'No description provided for this market.'}
				</p>
				<div class="rounded-2xl bg-slate-50 p-4">
					<h5 class="text-[10px] font-bold text-slate-400 uppercase">Resolution</h5>
					<p class="mt-1 text-xs text-slate-500">
						This market will resolve based on verifiable public data at the time of expiry.
					</p>
				</div>
			</div>
		{/if}

		<!-- Social links (Visual footer, always present) -->
		<div class="mt-12 flex justify-center gap-4 border-t border-slate-50 pt-6 text-slate-400">
			<span class="text-xl">𝕏</span>
			<span class="text-xl">✈</span>
			<span class="text-xl">tiktok</span>
			<span class="text-xl">f</span>
			<span class="text-xl">r</span>
		</div>
	</div>
</div>
