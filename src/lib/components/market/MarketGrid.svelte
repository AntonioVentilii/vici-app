<script lang="ts">
	import MarketCard from '$lib/components/market/MarketCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { Market } from '$lib/types/market';

	interface Props {
		markets: Market[];
		loading: boolean;
	}

	const { markets, loading }: Props = $props();
</script>

{#if loading}
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each Array(6) as _, i (i)}
			<div class="h-80 animate-pulse rounded-2xl bg-white/5"></div>
		{/each}
	</div>
{:else if markets.length > 0}
	<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each markets as market (market.id)}
			<MarketCard {market} />
		{/each}
	</div>
{:else}
	<EmptyState message="No markets found. Try adjusting your filters or search term." />
{/if}
