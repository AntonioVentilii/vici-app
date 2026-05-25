<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import MarketCardSkeleton from '$lib/components/market/MarketCardSkeleton.svelte';
	import StackedMarketCard from '$lib/components/market/StackedMarketCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { MarketTag } from '$lib/constants/market-tags.constants';
	import { TestId } from '$lib/constants/test-ids.constants';
	import { authPrincipal } from '$lib/derived/user.derived';
	import type { Market } from '$lib/types/market';
	import type { MarketMetadata } from '$lib/types/market-metadata';
	import { groupMarketsByLineage } from '$lib/utils/market-groups.utils';

	interface Props {
		markets: Market[];
		loading: boolean;
		// Required so the empty-state copy is always localised at the
		// call site (see `MarketsPage` for the canonical `markets.empty`
		// i18n key). No default — keeping one here would silently leak
		// untranslated English back into the feed.
		emptyMessage: string;
		hasMore?: boolean;
		onLoadMore?: () => void;
		onChallenge?: (market: Market) => void;
		metadataBySeries?: Record<string, MarketMetadata>;
		/** Per-series category-tag lookup; forwarded to MarketCard for the
		 *  colored category chip in the header strip. Optional so a parent
		 *  page that hasn't hydrated tags yet stays backward-compatible. */
		tagsBySeries?: Record<string, MarketTag[]>;
	}

	let {
		markets,
		loading,
		emptyMessage,
		hasMore = false,
		onLoadMore,
		onChallenge,
		metadataBySeries,
		tagsBySeries
	}: Props = $props();

	const groups = $derived(groupMarketsByLineage({ markets, userPrincipal: $authPrincipal }));

	const loadMoreSentinel: Attachment = (node) => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loading) {
					onLoadMore?.();
				}
			},
			{ rootMargin: '400px' }
		);

		observer.observe(node);

		return () => observer.disconnect();
	};

	let isGrid = $derived(groups.length > 0 || loading);
</script>

<div
	class="mx-auto w-full max-w-4xl pb-20"
	class:flex={!isGrid}
	class:gap-3={isGrid}
	class:grid={isGrid}
	class:grid-cols-1={isGrid}
	class:items-center={!isGrid}
	class:justify-center={!isGrid}
	data-tid={TestId.MarketFeed}
>
	{#if groups.length > 0}
		{#each groups as group, index (group.rootId)}
			<StackedMarketCard
				{group}
				{index}
				{metadataBySeries}
				{onChallenge}
				{tagsBySeries}
				userPrincipal={$authPrincipal}
			/>
		{/each}

		{#if loading}
			{#each Array(2) as _, i (i)}
				<MarketCardSkeleton />
			{/each}
		{/if}

		{#if hasMore}
			<div class="flex h-20 items-center justify-center" {@attach loadMoreSentinel}>
				<div
					class="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
				></div>
			</div>
		{/if}
	{:else if loading}
		{#each Array(3) as _, i (i)}
			<MarketCardSkeleton />
		{/each}
	{:else}
		<EmptyState message={emptyMessage} />
	{/if}
</div>
