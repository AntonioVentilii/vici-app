<script lang="ts">
	import { Heart } from 'lucide-svelte/icons';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import MarketsCarousel from '$lib/components/market/MarketsCarousel.svelte';
	import MarketsCategoryChips, {
		type MarketsCategoryFilter
	} from '$lib/components/market/MarketsCategoryChips.svelte';
	import MarketsListRow from '$lib/components/market/MarketsListRow.svelte';
	import {
		MARKET_TAG_LABEL_KEYS,
		primaryMarketTag,
		type MarketTag
	} from '$lib/constants/market-tags.constants';
	import { marketTags } from '$lib/derived/market-tags.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { preferencesStore } from '$lib/stores/preferences.store';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

	const TRENDING_LIMIT = 8;
	const SAVED_RAIL_LIMIT = 6;

	let cat = $state<MarketsCategoryFilter>('all');

	const loading = $derived($marketsNotInitialized);

	const savedSet = $derived(new Set($preferencesStore.savedMarketIds));
	const savedMarkets = $derived($markets.filter((market) => savedSet.has(market.id)));
	const savedCount = $derived(savedMarkets.length);

	const tagsByMarket = $derived($marketTags);

	const matchesTag = ({ market, tag }: { market: Market; tag: MarketTag }): boolean => {
		const tags = tagsByMarket[market.id];

		return tags?.includes(tag) ?? false;
	};

	const list = $derived.by((): Market[] => {
		const active = cat;

		if (active === 'saved') {
			return savedMarkets;
		}

		if (active === 'all') {
			return $markets;
		}

		return $markets.filter((market) => matchesTag({ market, tag: active }));
	});

	/**
	 * "Trending" rail — `cat === 'all'` only. Prototype filters on a
	 * `hot` flag; we proxy that by sorting open markets by
	 * `totalVolume` desc and slicing the top {@link TRENDING_LIMIT}.
	 * Resolved markets are excluded so the rail tracks live activity.
	 */
	const trendingMarkets = $derived(
		[...$markets]
			.filter((market) => market.status === 'Open')
			.sort((a, b) => {
				if (b.totalVolume === a.totalVolume) {
					return 0;
				}

				return b.totalVolume > a.totalVolume ? 1 : -1;
			})
			.slice(0, TRENDING_LIMIT)
	);

	const sectionTitle = $derived.by((): string => {
		if (cat === 'all') {
			return t({ locale: $localeStore, key: 'markets.section.all' });
		}

		if (cat === 'saved') {
			return t({ locale: $localeStore, key: 'markets.section.saved' });
		}

		return t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[cat] });
	});
</script>

{#snippet marketsTitle()}
	<h2 class="markets-hero-title">{t({ locale: $localeStore, key: 'nav.markets' })}</h2>
{/snippet}

<section class="markets-root">
	<MobileAppBar align="left" titleChildren={marketsTitle} />

	<MarketsCategoryChips active={cat} onChange={(next) => (cat = next)} {savedCount} />

	{#if cat === 'all' && savedCount > 0}
		<MarketsCarousel
			markets={savedMarkets.slice(0, SAVED_RAIL_LIMIT)}
			moreLabel={t({
				locale: $localeStore,
				key: 'markets.see_all_count',
				params: { count: savedCount }
			})}
			onMore={() => (cat = 'saved')}
			tagsBySeries={tagsByMarket}
			title={t({ locale: $localeStore, key: 'markets.section.saved' })}
		/>
	{/if}

	{#if cat === 'all' && trendingMarkets.length > 0}
		<MarketsCarousel
			markets={trendingMarkets}
			tagsBySeries={tagsByMarket}
			title={t({ locale: $localeStore, key: 'markets.section.trending' })}
		/>
	{/if}

	{#if cat === 'saved' && savedMarkets.length === 0 && !loading}
		<div class="markets-saved-empty" aria-live="polite" role="status">
			<Heart class="markets-saved-empty-icon" aria-hidden="true" size={28} strokeWidth={1.4} />
			<p class="markets-saved-empty-title serif-italic">
				{t({ locale: $localeStore, key: 'markets.saved_empty.title' })}
			</p>
			<p class="markets-saved-empty-body">
				{t({ locale: $localeStore, key: 'markets.saved_empty.body' })}
			</p>
		</div>
	{:else}
		<section class="markets-section">
			<header class="markets-section-head">
				<h2 class="markets-section-title">{sectionTitle}</h2>
				<span class="num markets-section-count">{list.length}</span>
			</header>

			{#if loading}
				<div class="markets-list">
					{#each Array(4) as _, index (index)}
						<div class="markets-row-skeleton" aria-hidden="true"></div>
					{/each}
				</div>
			{:else if list.length === 0}
				<div class="markets-empty">
					<p class="markets-empty-body">
						{t({ locale: $localeStore, key: 'markets.empty' })}
					</p>
				</div>
			{:else}
				<div class="markets-list">
					{#each list as market (market.id)}
						<MarketsListRow {market} tag={primaryMarketTag(tagsByMarket[market.id])} />
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</section>

<style lang="postcss">
	.markets-root {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 0 1.25rem 6rem;
	}

	.markets-hero-title {
		margin: 0;
		color: var(--text-base);
		font-family: var(--font-display, inherit);
		font-size: var(--t-24);
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: var(--tracking-tight);
	}

	.markets-saved-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem 1.5rem;
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
		background: transparent;
		text-align: center;
	}

	.markets-saved-empty :global(.markets-saved-empty-icon) {
		color: var(--parchment-faint);
		margin-bottom: 0.25rem;
	}

	.markets-saved-empty-title {
		margin: 0;
		font-size: var(--t-18);
		color: var(--text-base);
	}

	.markets-saved-empty-body {
		margin: 0;
		max-width: 28rem;
		font-size: var(--t-13);
		line-height: 1.55;
		color: var(--text-muted);
	}

	.markets-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.markets-section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.25rem 0 0.25rem;
	}

	.markets-section-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-15);
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-base);
	}

	.markets-section-count {
		color: var(--text-muted);
		font-size: var(--t-13);
		font-weight: 700;
	}

	.markets-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.markets-row-skeleton {
		height: 5.5rem;
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 60%, transparent);
		animation: markets-skel-pulse 1.5s ease-in-out infinite;
	}

	@keyframes markets-skel-pulse {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 0.9;
		}
	}

	.markets-empty {
		padding: 2rem 1rem;
		text-align: center;
		border: 1px dashed var(--border-base);
		border-radius: var(--r-12);
	}

	.markets-empty-body {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-13);
		line-height: 1.55;
	}
</style>
