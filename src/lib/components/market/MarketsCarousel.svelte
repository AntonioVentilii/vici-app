<script lang="ts">
	import MarketsFeaturedCard from '$lib/components/market/MarketsFeaturedCard.svelte';
	import { primaryMarketTag, type MarketTag } from '$lib/constants/market-tags.constants';
	import type { Market } from '$lib/types/market';

	/**
	 * Section header + horizontally-scrolling row of `MarketsFeaturedCard`s.
	 * Used by the Saved and Trending rails on the markets page.
	 */
	interface Props {
		title: string;
		markets: Market[];
		tagsBySeries?: Record<string, MarketTag[]>;
		moreLabel?: string;
		onMore?: () => void;
	}

	const { title, markets, tagsBySeries, moreLabel, onMore }: Props = $props();
</script>

<div class="section-h">
	<h3>{title}</h3>
	{#if moreLabel && onMore}
		<button class="title-action" onclick={onMore} type="button">{moreLabel}</button>
	{:else if moreLabel}
		<span style="cursor: default;" class="title-action">{moreLabel}</span>
	{/if}
</div>
<div
	style="display: flex; gap: 12px; padding: 4px 20px 12px; overflow-x: auto;"
	class="no-scrollbar"
>
	{#each markets as market (market.id)}
		<MarketsFeaturedCard {market} tag={primaryMarketTag(tagsBySeries?.[market.id])} />
	{/each}
</div>
