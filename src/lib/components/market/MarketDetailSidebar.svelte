<script lang="ts">
	import OutcomeBadge from '$lib/components/market/OutcomeBadge.svelte';
	import PredictionInterface from '$lib/components/market/PredictionInterface.svelte';
	import type { Market } from '$lib/types/market';

	interface Props {
		market: Market;
		onPredictionPlaced: () => void;
	}

	const { market, onPredictionPlaced }: Props = $props();
</script>

<aside class="space-y-8">
	{#if market.status === 'Open'}
		<PredictionInterface {market} {onPredictionPlaced} />
	{:else}
		<div class="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
			<div class="flex justify-center">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600"
				>
					<svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M12 15v2m0 0v3m0-3h3m-3 0H9m12-3a9 9 0 11-18 0 9 9 0 0118 0z"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
						/>
					</svg>
				</div>
			</div>
			<h3 class="text-xl font-black tracking-wider text-slate-950 uppercase">Trading Closed</h3>
			<p class="text-slate-600">This market is no longer active.</p>
			{#if market.outcome}
				<div class="mt-4 border-t border-slate-100 pt-4">
					<div class="text-xs font-bold tracking-widest text-slate-500 uppercase">
						Resolution Outcome
					</div>
					<div class="mt-2">
						<OutcomeBadge outcome={market.outcome} />
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Depth Info -->
	<div class="space-y-4 rounded-3xl border border-slate-100 bg-slate-50 p-6">
		<h4 class="text-xs font-black tracking-widest text-slate-500 uppercase">Market Insights</h4>
		<div class="space-y-3">
			<div class="flex justify-between text-sm">
				<span class="text-slate-500">Creator</span>
				<span class="font-medium text-slate-950">{market.creator.toText().substring(0, 10)}...</span
				>
			</div>
			<div class="flex justify-between text-sm">
				<span class="text-slate-500">Invite Only</span>
				<span class="font-medium text-slate-950">{market.isInviteOnly ? 'Yes' : 'No'}</span>
			</div>
			<div class="flex justify-between text-sm">
				<span class="text-slate-500">Liquidity</span>
				<span class="font-bold text-indigo-600">Medium</span>
			</div>
		</div>
	</div>
</aside>
