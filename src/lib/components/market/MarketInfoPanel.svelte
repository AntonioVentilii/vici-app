	import MarketRecentTrades from '$lib/components/market/MarketRecentTrades.svelte';
	import ProbabilityChart from '$lib/components/market/ProbabilityChart.svelte';
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

<div
	class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md"
>
	<!-- Tab-like Header -->
	<div class="flex border-b border-slate-100 bg-slate-50/50">
		{#each ['Odds', 'History', 'Rules'] as tab (tab)}
			<button
				class="flex-1 px-4 py-3 text-xs font-bold transition-all {selectedTab === tab
					? 'border-b-2 border-indigo-600 bg-white text-indigo-600'
					: 'text-slate-400 hover:text-slate-600'}"
				onclick={() => (selectedTab = tab as typeof selectedTab)}
			>
				{tab === 'Rules' ? 'Resolution' : tab}
			</button>
		{/each}
	</div>

	<div class="min-h-[400px] p-6">
		{#if selectedTab === 'Odds'}
			<div class="space-y-8">
				<!-- High-impact Time Left -->
				<div class="rounded-2xl bg-indigo-50/50 p-4 text-center ring-1 ring-indigo-100">
					<span class="text-[10px] font-black tracking-widest text-indigo-400 uppercase"
						>Trading Ends In</span
					>
					<div class="mt-1 font-mono text-2xl font-black text-indigo-600">
						{timeRemaining}
					</div>
				</div>

				<!-- Trend Chart -->
				<ProbabilityChart />

				<div class="space-y-4 border-t border-slate-50 pt-4">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold text-slate-400 uppercase">Total Pool</span>
						<div class="flex items-center gap-1.5">
							<span class="text-sm font-black text-slate-900">
								{formatCurrency({ value: market.totalVolume, decimals: market.token.decimals })}
							</span>
							<span class="text-[10px] font-bold text-slate-400">{market.token.symbol}</span>
						</div>
					</div>

					<div class="flex items-center justify-between">
						<span class="text-xs font-bold text-slate-400 uppercase">Total Predictions</span>
						<span class="text-sm font-black text-slate-900"
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
			<div class="space-y-6">
				<div class="space-y-3">
					<h4 class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
						Official Criteria
					</h4>
					<div
						class="rounded-2xl border border-slate-100 bg-slate-50/30 p-5 leading-relaxed text-slate-600"
					>
						<div class="flex gap-3">
							<span class="font-bold text-indigo-500">●</span>
							<p class="text-sm">{market.description || 'Verified via public consensus.'}</p>
						</div>
					</div>
				</div>

				<div class="space-y-4">
					<div class="flex items-start gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-100">
						<span class="text-lg">⚖️</span>
						<div>
							<h5 class="text-[10px] font-black text-amber-800 uppercase">Settlement Rule</h5>
							<p class="mt-1 text-xs leading-snug text-amber-700/80">
								This market will resolve based on verifiable public data at the time of expiry. If
								the outcome is ambiguous, it will be decided by the Vici Oracle Council.
							</p>
						</div>
					</div>
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
