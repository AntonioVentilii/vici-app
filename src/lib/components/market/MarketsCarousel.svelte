<script lang="ts">
	import MarketsFeaturedCard from '$lib/components/market/MarketsFeaturedCard.svelte';
	import { primaryMarketTag, type MarketTag } from '$lib/constants/market-tags.constants';
	import type { Market } from '$lib/types/market';

	interface Props {
		title: string;
		markets: Market[];
		tagsBySeries?: Record<string, MarketTag[]>;
		/**
		 * Click target for the inline "See all" link. Pass a string for
		 * an arbitrary CTA label or omit to hide the link.
		 */
		moreLabel?: string;
		onMore?: () => void;
	}

	const { title, markets, tagsBySeries, moreLabel, onMore }: Props = $props();
</script>

<section class="markets-carousel" aria-label={title}>
	<header class="markets-carousel-head">
		<h2 class="markets-carousel-title">{title}</h2>
		{#if moreLabel && onMore}
			<button class="markets-carousel-more" onclick={onMore} type="button">{moreLabel}</button>
		{/if}
	</header>
	<div class="markets-carousel-scroller no-scrollbar">
		{#each markets as market (market.id)}
			<MarketsFeaturedCard {market} tag={primaryMarketTag(tagsBySeries?.[market.id])} />
		{/each}
	</div>
</section>

<style lang="postcss">
	.markets-carousel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.markets-carousel-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.markets-carousel-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-15);
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-base);
	}

	.markets-carousel-more {
		color: var(--color-primary);
		font-size: var(--t-13);
		font-weight: 500;
		cursor: pointer;
		transition: opacity var(--d-hover) var(--ease-vici);
	}

	.markets-carousel-more:hover {
		opacity: 0.8;
	}

	.markets-carousel-scroller {
		display: flex;
		gap: 0.75rem;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		margin: 0 -1rem;
		padding: 0.25rem 1rem 0.25rem;
	}

	.markets-carousel-scroller::-webkit-scrollbar {
		display: none;
	}
</style>
