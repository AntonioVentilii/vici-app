<script lang="ts">
	import { onMount } from 'svelte';
	import MarketCard from '$lib/components/market/MarketCard.svelte';
	import MarketCardSkeleton from '$lib/components/market/MarketCardSkeleton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { Market } from '$lib/types/market';

	interface Props {
		markets: Market[];
		loading: boolean;
		hasMore?: boolean;
		onLoadMore?: () => void;
	}

	let { markets, loading, hasMore = false, onLoadMore }: Props = $props();

	let observer: IntersectionObserver | undefined;
	let sentinel: HTMLElement | undefined = $state();

	$effect(() => {
		if (sentinel && hasMore && !loading && onLoadMore) {
			observer = new IntersectionObserver(
				(entries) => {
					if (entries[0].isIntersecting) {
						onLoadMore();
					}
				},
				{ rootMargin: '400px' }
			);
			observer.observe(sentinel);
		} else {
			observer?.disconnect();
		}
	});

	onMount(() => () => observer?.disconnect());
</script>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-20 sm:gap-10">
	{#if markets.length > 0}
		{#each markets as market, index (market.id)}
			<MarketCard {index} {market} />
		{/each}

		{#if loading}
			{#each Array(2) as _, i (i)}
				<MarketCardSkeleton />
			{/each}
		{/if}

		{#if hasMore}
			<div bind:this={sentinel} class="flex h-20 items-center justify-center">
				<div
					class="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
				></div>
			</div>
		{/if}
	{:else if loading}
		{#each Array(3) as _, i (i)}
			<MarketCardSkeleton />
		{/each}
	{:else}
		<EmptyState message="No markets found. Try adjusting your filters or search term." />
	{/if}
</div>
