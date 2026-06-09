<script lang="ts">
	import ScreenHeader from '$lib/components/layout/ScreenHeader.svelte';
	import MarketsBeyondCupCard from '$lib/components/market/MarketsBeyondCupCard.svelte';
	import MarketsCarousel from '$lib/components/market/MarketsCarousel.svelte';
	import MarketsListRow from '$lib/components/market/MarketsListRow.svelte';
	import WorldCupRecapCard from '$lib/components/market/WorldCupRecapCard.svelte';
	import { DAY_IN_MS } from '$lib/constants/app.constants';
	import { primaryMarketTag, type MarketTag } from '$lib/constants/market-tags.constants';
	import { marketTags, marketTagsNotInitialized } from '$lib/derived/market-tags.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { minuteTick_ms } from '$lib/derived/time.derived';
	import { worldCupPhase } from '$lib/derived/world-cup.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { preferencesStore } from '$lib/stores/preferences.store';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';
	import { prefersReducedMotion } from '$lib/utils/reduced-motion.utils';

	/**
	 * Markets screen — a section-based board (no filter chips). The World Cup
	 * is the in-focus category; every other category stays locked behind the
	 * "Beyond the Cup" skill gate (`MarketsBeyondCupCard`), surfaced high. The
	 * board itself is three sections: Saved (the viewer's watchlist), Resolving
	 * soon (the soonest-closing available lines), and Available predictions.
	 *
	 * Placing a call happens in Flow — this board has no buy path; rows deep-link
	 * to market detail. Saved-ids persist under `vici.saved-markets` via
	 * `$preferencesStore.savedMarketIds`.
	 */

	// A market counts as "resolving soon" when it closes within this window.
	// Our market type has no curated `fast` flag, so we proxy it by closeness to
	// the `expiryDate` — the soonest-closing lines surface first, framing the
	// board as "what settles soon" for new users.
	const RESOLVING_SOON_WINDOW_MS = 7 * DAY_IN_MS;
	const TRENDING_LIMIT = 8;

	// The retention-arc phase drives the WC chrome live. `wc-focus` / `bridge`
	// keep the laser focus on the World Cup; `open` (the Cup resolved) and `off`
	// widen the board to every category (there's no focused event to anchor on).
	const phase = $derived($worldCupPhase);
	const wcFocus = $derived(phase === 'wc-focus' || phase === 'bridge');
	const isOpen = $derived(phase === 'open');

	// Header context chip: the featured event, surfaced as a single mono chip
	// while the board is laser-focused on it. Chips-only header — no title or
	// subtitle. Omitted once no event is in focus (`open` / `off`).
	const eventChips = $derived(
		wcFocus ? [{ label: t({ locale: $localeStore, key: 'markets.wc_eyebrow' }) }] : undefined
	);

	// Loading covers both feeds the board depends on: the markets list and — in
	// World-Cup focus, where the board filters by the `wc` tag — the tag
	// metadata. Without the tag guard, `availableMarkets` is briefly empty while
	// tags fetch, flashing the "no markets" empty state over loaded markets.
	const loading = $derived($marketsNotInitialized || (wcFocus && $marketTagsNotInitialized));

	const savedSet = $derived(new Set($preferencesStore.savedMarketIds));
	// Saved = the viewer's watchlist, kept even if an entry isn't World Cup.
	const savedMarkets = $derived($markets.filter((m) => savedSet.has(m.id)));

	const tagsByMarket = $derived($marketTags);

	const matchesTag = ({ market, tag }: { market: Market; tag: MarketTag }): boolean =>
		tagsByMarket[market.id]?.includes(tag) ?? false;

	// Volume-sort helper — the same trending signal the carousel uses, applied
	// to give a stable deck that doesn't reshuffle as the user scans it.
	// eslint-disable-next-line local-rules/prefer-object-params -- Array.sort comparators take two positional args by contract
	const byVolumeDesc = (a: Market, b: Market): number => {
		if (b.totalVolume === a.totalVolume) {
			return 0;
		}

		return b.totalVolume > a.totalVolume ? 1 : -1;
	};

	// The "available" board. While the World Cup is in focus the board is the WC
	// category only (the single open event); once the arc opens up (`open` /
	// `off`) it's every market — so the page keeps working past the Cup. Gated
	// on tag metadata being initialized so a WC filter doesn't collapse the board
	// to empty before tags load. Both branches list only `Open` (callable) lines
	// — matching the section label and the Open-only Trending rail — so resolved
	// / expired markets never surface under "Available predictions".
	const availableMarkets = $derived.by((): Market[] => {
		const openMarkets = $markets.filter((m) => m.status === 'Open');

		if (!wcFocus) {
			return [...openMarkets].sort(byVolumeDesc);
		}

		if ($marketTagsNotInitialized) {
			return [];
		}

		return openMarkets.filter((m) => matchesTag({ market: m, tag: 'wc' }));
	});

	// Resolving soon: available lines closing within the window, soonest first.
	const resolvingSoon = $derived.by((): Market[] => {
		const now = $minuteTick_ms;

		return availableMarkets
			.filter((m) => {
				const expiry = Number(m.expiryDate);

				return expiry > now && expiry - now <= RESOLVING_SOON_WINDOW_MS;
			})
			.sort((a, b) => Number(a.expiryDate) - Number(b.expiryDate));
	});

	const resolvingSoonIds = $derived(new Set(resolvingSoon.map((m) => m.id)));

	// Available predictions: the rest of the available board (everything not
	// already surfaced in "Resolving soon"), volume-sorted.
	const restMarkets = $derived(
		[...availableMarkets].filter((m) => !resolvingSoonIds.has(m.id)).sort(byVolumeDesc)
	);

	// Trending rail: highest-volume open markets. Our backend carries no curated
	// "hot" flag, so volume is the proxy.
	const trendingMarkets = $derived(
		[...$markets]
			.filter((m) => m.status === 'Open')
			.sort(byVolumeDesc)
			.slice(0, TRENDING_LIMIT)
	);

	// "See all" on the trending rail scrolls to the main list rather than a
	// separate route — the list is sorted by the same volume signal.
	let mainListEl: HTMLElement | undefined = $state();

	const scrollToMainList = (): void => {
		mainListEl?.scrollIntoView({
			behavior: prefersReducedMotion() ? 'auto' : 'smooth',
			block: 'start'
		});
	};
</script>

<div class="screen-scroll">
	<!-- Chips-only header: no title or subtitle, just the featured-event
	     context chip (omitted entirely once no event is in focus). -->
	<ScreenHeader chips={eventChips} variant="section" />

	<!-- `open` phase: the Cup has resolved. Recap the viewer's World-Cup run at
	     the top of the board and convert it into broader play. -->
	{#if isOpen}
		<WorldCupRecapCard onExplore={scrollToMainList} />
	{/if}

	<!-- Beyond the Cup — the skill-gate unlock goal, surfaced high. -->
	<MarketsBeyondCupCard
		markets={$markets}
		{tagsByMarket}
		tagsInitialized={!$marketTagsNotInitialized}
	/>

	<!-- Trending rail. -->
	{#if trendingMarkets.length > 0}
		<MarketsCarousel
			markets={trendingMarkets}
			moreLabel={t({ locale: $localeStore, key: 'markets.see_all' })}
			onMore={scrollToMainList}
			tagsBySeries={tagsByMarket}
			title={t({ locale: $localeStore, key: 'markets.section.trending' })}
		/>
	{/if}

	<!-- Saved (primary) — the viewer's watchlist. -->
	<div class="section-h">
		<h3>{t({ locale: $localeStore, key: 'markets.section.saved' })}</h3>
		<span class="mute t-sub">{savedMarkets.length}</span>
	</div>
	{#if loading}
		<!-- Suppress the "nothing saved yet" card while markets load — saved IDs
		     may exist but their markets haven't resolved into the list yet. -->
		<div style="gap: 8px; padding: 0 20px 20px;" class="col">
			{#each Array(2) as _, index (index)}
				<div
					style="height: 88px; border: 1px dashed var(--border-base); border-radius: 12px; opacity: 0.7;"
					aria-hidden="true"
				></div>
			{/each}
		</div>
	{:else if savedMarkets.length === 0}
		<div style="margin: 4px 20px 20px;" class="card-empty">
			<span class="c-eyebrow">{t({ locale: $localeStore, key: 'markets.section.saved' })}</span>
			<span style="line-height: 1.25;" class="c-title"
				>{t({ locale: $localeStore, key: 'markets.saved_empty.title' })}</span
			>
			<p class="c-body">
				{t({ locale: $localeStore, key: 'markets.saved_empty.body' })}
			</p>
		</div>
	{:else}
		<div style="gap: 0; padding: 0 20px 20px;" class="col">
			{#each savedMarkets as m (m.id)}
				<MarketsListRow market={m} tag={primaryMarketTag(tagsByMarket[m.id])} />
			{/each}
		</div>
	{/if}

	<!-- Resolving soon — the soonest-closing available lines first. -->
	{#if resolvingSoon.length > 0}
		<div class="section-h">
			<h3>{t({ locale: $localeStore, key: 'markets.section.resolving_soon' })}</h3>
			<span class="mute t-sub">{resolvingSoon.length}</span>
		</div>
		<div style="gap: 0; padding: 0 20px 20px;" class="col">
			{#each resolvingSoon as m (m.id)}
				<MarketsListRow market={m} tag={primaryMarketTag(tagsByMarket[m.id])} />
			{/each}
		</div>
	{/if}

	<!-- Available predictions — the rest of the available board. -->
	<div bind:this={mainListEl} style="scroll-margin-top: 12px;" class="section-h">
		<h3>{t({ locale: $localeStore, key: 'markets.section.available' })}</h3>
		<span class="mute t-sub">{restMarkets.length}</span>
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
	{:else if restMarkets.length === 0}
		<div style="margin: 0 20px 20px;" class="card-empty">
			<p class="c-body">
				{t({ locale: $localeStore, key: 'markets.empty' })}
			</p>
		</div>
	{:else}
		<div style="gap: 0; padding: 0 20px calc(96px + env(safe-area-inset-bottom, 0px));" class="col">
			{#each restMarkets as m (m.id)}
				<MarketsListRow market={m} tag={primaryMarketTag(tagsByMarket[m.id])} />
			{/each}
		</div>
	{/if}
</div>
