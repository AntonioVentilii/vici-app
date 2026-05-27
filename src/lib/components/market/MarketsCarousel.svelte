<script lang="ts">
	import MarketsFeaturedCard from '$lib/components/market/MarketsFeaturedCard.svelte';
	import { primaryMarketTag, type MarketTag } from '$lib/constants/market-tags.constants';
	import type { Market } from '$lib/types/market';

	/**
	 * Verbatim port of the prototype's inline carousel block
	 * (screens.jsx:116-124 — Saved rail; screens.jsx:129-135 —
	 * Trending rail):
	 *
	 *   <div className="section-h">
	 *     <h3>{title}</h3>
	 *     <span className="more" style={...} onClick={onMore}>{moreLabel}</span>
	 *   </div>
	 *   <div className="no-scrollbar"
	 *        style={{ display: 'flex', gap: 12, padding: '4px 20px 12px', overflowX: 'auto' }}>
	 *     {items.map((m) => <FeaturedCard key={m.id} m={m} onClick={...} />)}
	 *   </div>
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
		<button class="more" onclick={onMore} type="button">{moreLabel}</button>
	{:else if moreLabel}
		<span class="more">{moreLabel}</span>
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
