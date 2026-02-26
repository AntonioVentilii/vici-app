<script lang="ts">
	import type { Market, MarketId, Outcome } from '$lib/types/market';

	interface Props {
		markets: Market[];
		loading: boolean;
		onResolve: (params: { marketId: MarketId; outcome: Outcome }) => void;
	}

	const { markets, loading, onResolve }: Props = $props();
</script>

<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
	<h2 class="mb-6 text-2xl font-bold text-slate-950">Resolve Active Markets</h2>

	{#if loading}
		<div class="flex justify-center py-12">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"
			></div>
		</div>
	{:else if markets.length === 0}
		<p class="py-12 text-center text-sm text-slate-500 italic">
			No active markets requiring resolution.
		</p>
	{:else}
		<div class="space-y-6">
			{#each markets as market (market.id)}
				{@const { id: marketId, title } = market}

				<div class="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-6">
					<div class="flex items-start justify-between">
						<h3 class="line-clamp-1 font-bold text-slate-950">{title}</h3>
						<span class="font-mono text-[10px] text-slate-500">ID: {marketId}</span>
					</div>

					<div class="flex gap-2">
						<button
							class="flex-1 rounded-xl border border-green-200 bg-green-50 py-2 text-xs font-bold text-green-700 transition-all hover:bg-green-100"
							onclick={() => onResolve({ marketId, outcome: 'YES' })}
						>
							Resolve YES
						</button>
						<button
							class="flex-1 rounded-xl border border-red-200 bg-red-50 py-2 text-xs font-bold text-red-700 transition-all hover:bg-red-100"
							onclick={() => onResolve({ marketId, outcome: 'NO' })}
						>
							Resolve NO
						</button>
						<button
							class="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-100"
							onclick={() => onResolve({ marketId, outcome: 'CANCELED' })}
						>
							Cancel
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
