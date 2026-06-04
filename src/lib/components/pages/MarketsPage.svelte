<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { get } from 'svelte/store';
	import PageScaffold from '$lib/components/layout/PageScaffold.svelte';
	import MarketsCarousel from '$lib/components/market/MarketsCarousel.svelte';
	import MarketsCategoryChips, {
		type MarketsCategoryFilter
	} from '$lib/components/market/MarketsCategoryChips.svelte';
	import MarketsListRow from '$lib/components/market/MarketsListRow.svelte';
	import WorldCupRecapCard from '$lib/components/market/WorldCupRecapCard.svelte';
	import {
		MARKET_TAG_LABEL_KEYS,
		primaryMarketTag,
		type MarketTag
	} from '$lib/constants/market-tags.constants';
	import { marketTags, marketTagsNotInitialized } from '$lib/derived/market-tags.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { worldCupPhase } from '$lib/derived/world-cup.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { preferencesStore } from '$lib/stores/preferences.store';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	/**
	 * Markets screen — chip rail (Saved + per-category) above a
	 * Trending carousel and the main list. Data comes from the
	 * `$markets` derived store plus
	 * `$preferencesStore.savedMarketIds`; the saved-ids persistence
	 * is keyed under `vici.saved-markets` in localStorage.
	 */
	const TRENDING_LIMIT = 8;
	const SAVED_RAIL_LIMIT = 6;
	// How many non-WC markets the `bridge`-phase "Beyond the Cup" rail seeds —
	// enough to preview the post-Cup deck without competing with the focus.
	const BEYOND_RAIL_LIMIT = 6;

	// Initial focus: in the WC-focused phases of the retention arc
	// (`wc-focus` / `bridge`) the Markets list opens laser-focused on the
	// World Cup (the `wc` tag is the default filter and the other categories
	// collapse behind "More markets →"). In `open` (the Cup has resolved) and
	// `off` (no opt-in) the list keeps its all-categories shape. Read once at
	// init via `get` — the phase doesn't flip mid-session in practice, and
	// tying the default to a live `$derived` would fight the user once they
	// pick another chip.
	const initialPhase = get(worldCupPhase);
	let cat = $state<MarketsCategoryFilter>(
		initialPhase === 'wc-focus' || initialPhase === 'bridge' ? 'wc' : 'all'
	);

	// The retention-arc phase drives the WC chrome live. `wc-focus` and
	// `bridge` both keep the laser focus (event eyebrow + collapsed
	// "More markets →" rail); `bridge` additionally seeds the "Beyond the
	// Cup" rail below. `open` (Cup resolved) and `off` revert to the
	// all-categories shape — so the focus chrome disappears the moment the
	// phase advances mid-session.
	const phase = $derived($worldCupPhase);
	const wcFocus = $derived(phase === 'wc-focus' || phase === 'bridge');
	const isBridge = $derived(phase === 'bridge');
	const isOpen = $derived(phase === 'open');

	// When the arc advances into `open` mid-session (the heartbeat crosses the
	// final), the World-Cup focus is over — drop the lingering `wc` filter back
	// to all-categories so the list and section title match the recap card and
	// the documented `open` behaviour. Guarded on the transition so it never
	// fights a user who deliberately picks the `wc` chip while in `open`.
	let prevPhase = $state(initialPhase);
	$effect(() => {
		if (prevPhase !== 'open' && phase === 'open' && cat === 'wc') {
			cat = 'all';
		}

		prevPhase = phase;
	});

	// Eyebrow copy: a single-line, localized event label rendered uppercase by
	// the header styling. Surfaced only while the list is laser-focused on the
	// featured event.
	const wcEyebrow = $derived(
		wcFocus ? t({ locale: $localeStore, key: 'markets.wc_eyebrow' }) : undefined
	);

	const loading = $derived($marketsNotInitialized);

	const savedSet = $derived(new Set($preferencesStore.savedMarketIds));
	const savedMarkets = $derived($markets.filter((m) => savedSet.has(m.id)));

	const tagsByMarket = $derived($marketTags);

	const matchesTag = ({ market, tag }: { market: Market; tag: MarketTag }): boolean =>
		tagsByMarket[market.id]?.includes(tag) ?? false;

	// Tags that currently resolve to at least one loaded market. Drives the
	// chip rail so we don't surface categories that would render the empty
	// state — the user can't filter into a dead end. Markets without
	// metadata contribute nothing here (the lookup returns `undefined`).
	//
	// Returns `undefined` while the tag store is still uninitialized so the
	// chip rail falls back to the full taxonomy rather than collapsing to a
	// single "All" chip during the first paint.
	const availableTags = $derived.by((): SvelteSet<MarketTag> | undefined => {
		if ($marketTagsNotInitialized) {
			return;
		}

		const set = new SvelteSet<MarketTag>();

		for (const m of $markets) {
			const tags = tagsByMarket[m.id];

			if (tags !== undefined) {
				for (const tag of tags) {
					set.add(tag);
				}
			}
		}

		return set;
	});

	// Filter the deck: saved-only when the saved chip is active,
	// otherwise either all open markets or those carrying the active
	// category tag. Ordered by totalVolume DESC — the same trending
	// signal the carousels use — for a stable deck that doesn't
	// reshuffle as the user scans it.
	const list = $derived.by((): Market[] => {
		const base = ((): Market[] => {
			if (cat === 'saved') {
				return savedMarkets;
			}

			if (cat === 'all') {
				return $markets;
			}

			const tag = cat as MarketTag;

			return $markets.filter((m) => matchesTag({ market: m, tag }));
		})();

		return [...base].sort((a, b) => {
			if (b.totalVolume === a.totalVolume) {
				return 0;
			}

			return b.totalVolume > a.totalVolume ? 1 : -1;
		});
	});

	// Our backend doesn't carry a hand-curated "hot" flag, so the
	// trending carousel proxies by sorting open markets by
	// `totalVolume` desc.
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

	// "Beyond the Cup" rail (bridge phase): a handful of the highest-volume
	// non-WC markets, previewed *before* the Cup resolves to pre-empt the
	// post-Cup cliff. Proxies "curated" by volume — the same trending signal
	// the carousels use — and excludes anything tagged `wc` so it genuinely
	// widens the deck. Gated on tag metadata being initialized: `matchesTag`
	// returns false against the empty fallback, so without this a WC market
	// could leak into the non-WC rail before tags load. Empty otherwise.
	const beyondMarkets = $derived.by((): Market[] => {
		if (!isBridge || $marketTagsNotInitialized) {
			return [];
		}

		return [...$markets]
			.filter((m) => m.status === 'Open' && !matchesTag({ market: m, tag: 'wc' }))
			.sort((a, b) => {
				if (b.totalVolume === a.totalVolume) {
					return 0;
				}

				return b.totalVolume > a.totalVolume ? 1 : -1;
			})
			.slice(0, BEYOND_RAIL_LIMIT);
	});

	// Section title — "All markets" / "Saved" / the active category's
	// label.
	const sectionTitle = $derived.by((): string => {
		if (cat === 'all') {
			return t({ locale: $localeStore, key: 'markets.section.all' });
		}

		if (cat === 'saved') {
			return t({ locale: $localeStore, key: 'markets.section.saved' });
		}

		return t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[cat] });
	});

	// The Trending rail is a volume-sorted preview of the deck below — the main
	// list is already sorted by the same `totalVolume` signal. "See all" on the
	// rail therefore brings the user down to the full, scrollable list rather
	// than to a separate route. Bind the list section so we can scroll to it,
	// honouring `prefers-reduced-motion` (no smooth animation when reduced).
	let mainListEl: HTMLElement | undefined = $state();

	const scrollToMainList = (): void => {
		mainListEl?.scrollIntoView({
			behavior: prefersReducedMotion() ? 'auto' : 'smooth',
			block: 'start'
		});
	};
</script>

<div class="screen-scroll">
	<PageScaffold eyebrow={wcEyebrow} title={t({ locale: $localeStore, key: 'nav.markets' })}>
		<!-- Category chips with Saved filter prepended. In WC-focus mode the
		     rail opens on the World Cup with the rest behind "More markets →". -->
		<MarketsCategoryChips
			active={cat}
			{availableTags}
			onChange={(next) => (cat = next)}
			savedCount={savedMarkets.length}
			{wcFocus}
		/>

		<!-- `open` phase: the Cup has resolved. Recap the user's World-Cup run
		     at the top of the list and convert it into broader play. The list
		     itself behaves as all-categories (no WC default). -->
		{#if isOpen}
			<WorldCupRecapCard onExplore={() => (cat = 'all')} />
		{/if}

		<!-- `bridge` phase: still WC-focused, but seed a "Beyond the Cup" rail
		     of curated non-WC markets before the Cup ends — a soft landing for
		     the post-Cup cliff. Shown on the focused (`wc`) view only, so it
		     doesn't double up once the user expands to other categories. -->
		{#if isBridge && cat === 'wc' && beyondMarkets.length > 0}
			<p class="beyond-eyebrow dim t-body-sm">
				{t({ locale: $localeStore, key: 'markets.beyond.line' })}
			</p>
			<MarketsCarousel
				markets={beyondMarkets}
				tagsBySeries={tagsByMarket}
				title={t({ locale: $localeStore, key: 'markets.beyond.title' })}
			/>
		{/if}

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
				onMore={scrollToMainList}
				tagsBySeries={tagsByMarket}
				title={t({ locale: $localeStore, key: 'markets.section.trending' })}
			/>
		{/if}

		<!-- Main list with Saved empty state. card-empty owns the dashed
		     border + the c-eyebrow / c-title / c-body type ramp. -->
		{#if cat === 'saved' && list.length === 0 && !loading}
			<div style="margin: 20px 20px 24px;" class="card-empty">
				<span class="c-eyebrow">{t({ locale: $localeStore, key: 'markets.section.saved' })}</span>
				<span class="c-title">{t({ locale: $localeStore, key: 'markets.saved_empty.title' })}</span>
				<p class="c-body">
					{t({ locale: $localeStore, key: 'markets.saved_empty.body' })}
				</p>
			</div>
		{:else}
			<div bind:this={mainListEl} style="scroll-margin-top: 12px;" class="section-h">
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
				<div style="margin: 0 20px 20px;" class="card-empty">
					<p class="c-body">
						{t({ locale: $localeStore, key: 'markets.empty' })}
					</p>
				</div>
			{:else}
				<div style="gap: 0; padding: 0 20px 20px;" class="col">
					{#each list as m (m.id)}
						<MarketsListRow market={m} tag={primaryMarketTag(tagsByMarket[m.id])} />
					{/each}
				</div>
			{/if}
		{/if}
	</PageScaffold>
</div>

<style lang="postcss">
	.beyond-eyebrow {
		margin: 4px 20px 0;
		max-width: 48ch;
	}
</style>
