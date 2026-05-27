<script lang="ts">
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

	/**
	 * Verbatim port of the prototype `MarketsScreen`
	 * (screens.jsx:82-159). Structure, class names, and inline
	 * pixel values mirror the JSX 1:1; the data source is swapped
	 * from `window.VICI_DATA.MARKETS` to our `$markets` derived
	 * store and `$preferencesStore.savedMarketIds` (the saved-ids
	 * persistence already mirrors the prototype's
	 * `vici.saved-markets` localStorage key, just behind a Svelte
	 * store rather than an ad-hoc CustomEvent).
	 */
	const TRENDING_LIMIT = 8;
	const SAVED_RAIL_LIMIT = 6;

	let cat = $state<MarketsCategoryFilter>('all');

	const loading = $derived($marketsNotInitialized);

	const savedSet = $derived(new Set($preferencesStore.savedMarketIds));
	const savedMarkets = $derived($markets.filter((m) => savedSet.has(m.id)));

	const tagsByMarket = $derived($marketTags);

	const matchesTag = ({ market, tag }: { market: Market; tag: MarketTag }): boolean =>
		tagsByMarket[market.id]?.includes(tag) ?? false;

	// Prototype line 94-96:
	//   const list = cat === 'saved'
	//     ? savedMarkets
	//     : window.VICI_DATA.MARKETS.filter((m) => cat === 'all' || m.cat === cat);
	const list = $derived.by((): Market[] => {
		if (cat === 'saved') {
			return savedMarkets;
		}

		if (cat === 'all') {
			return $markets;
		}

		const tag: MarketTag = cat;

		return $markets.filter((m) => matchesTag({ market: m, tag }));
	});

	// Prototype `m.hot` is a hand-curated flag we don't carry in our
	// backend; proxy by sorting open markets by `totalVolume` desc.
	const trendingMarkets = $derived(
		[...$markets]
			.filter((m) => m.status === 'Open')
			.sort((a, b) => {
				if (b.totalVolume === a.totalVolume) {
					return 0;
				}

				return b.totalVolume > a.totalVolume ? 1 : -1;
			})
			.slice(0, TRENDING_LIMIT)
	);

	// Prototype line 149:
	//   {cat === 'all' ? 'All markets'
	//      : cat === 'saved' ? 'Saved'
	//      : window.VICI_DATA.CATS.find((c) => c.id === cat).label}
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

<div class="screen-scroll">
	<div class="appbar">
		<h2 style="font-size: 24px; letter-spacing: -0.02em;">
			{t({ locale: $localeStore, key: 'nav.markets' })}
		</h2>
	</div>

	<!-- Category chips with Saved filter prepended -->
	<MarketsCategoryChips
		active={cat}
		onChange={(next) => (cat = next)}
		savedCount={savedMarkets.length}
	/>

	<!-- Saved carousel only visible on All view -->
	{#if cat === 'all' && savedMarkets.length > 0}
		<MarketsCarousel
			markets={savedMarkets.slice(0, SAVED_RAIL_LIMIT)}
			moreLabel={t({
				locale: $localeStore,
				key: 'markets.see_all_count',
				params: { count: savedMarkets.length }
			})}
			onMore={() => (cat = 'saved')}
			tagsBySeries={tagsByMarket}
			title={t({ locale: $localeStore, key: 'markets.section.saved' })}
		/>
	{/if}

	<!-- Trending on All view -->
	{#if cat === 'all' && trendingMarkets.length > 0}
		<MarketsCarousel
			markets={trendingMarkets}
			moreLabel={t({ locale: $localeStore, key: 'markets.see_all' })}
			tagsBySeries={tagsByMarket}
			title={t({ locale: $localeStore, key: 'markets.section.trending' })}
		/>
	{/if}

	<!-- Main list with Saved empty state -->
	{#if cat === 'saved' && list.length === 0 && !loading}
		<div
			style="margin: 20px 20px 24px; padding: 32px 22px; background: rgba(242,236,220,0.02); border: 1px dashed var(--border-base); border-radius: 14px; text-align: center;"
		>
			<div style="opacity: 0.4; margin-bottom: 8px;" class="t-display" aria-hidden="true">♥</div>
			<div style="font-size: 17px; margin-bottom: 6px;" class="serif-italic acc">
				"{t({ locale: $localeStore, key: 'markets.saved_empty.title' })}"
			</div>
			<p style="line-height: 1.5; margin: 0;" class="dim t-body-sm">
				{t({ locale: $localeStore, key: 'markets.saved_empty.body' })}
			</p>
		</div>
	{:else}
		<div class="section-h">
			<h3>{sectionTitle}</h3>
			<span class="mute t-sub">{list.length}</span>
		</div>
		{#if loading}
			<div style="gap: 8px; padding: 0 20px 20px;" class="col">
				{#each Array(4) as _, index (index)}
					<div
						style="height: 88px; border: 1px dashed var(--border-base); border-radius: 12px; opacity: 0.7;"
						aria-hidden="true"
					></div>
				{/each}
			</div>
		{:else if list.length === 0}
			<div
				style="margin: 0 20px 20px; padding: 32px 22px; border: 1px dashed var(--border-base); border-radius: 14px; text-align: center;"
			>
				<p style="margin: 0;" class="dim t-body-sm">
					{t({ locale: $localeStore, key: 'markets.empty' })}
				</p>
			</div>
		{:else}
			<div style="gap: 8px; padding: 0 20px 20px;" class="col">
				{#each list as m (m.id)}
					<MarketsListRow market={m} tag={primaryMarketTag(tagsByMarket[m.id])} />
				{/each}
			</div>
		{/if}
	{/if}
</div>
