<script lang="ts">
	import { Heart } from 'lucide-svelte/icons';
	import ForkMarketModal from '$lib/components/challenge/ForkMarketModal.svelte';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import MarketCard from '$lib/components/market/MarketCard.svelte';
	import MarketFeed from '$lib/components/market/MarketFeed.svelte';
	import MarketFilters from '$lib/components/market/MarketFilters.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { primaryMarketTag } from '$lib/constants/market-tags.constants';
	import { featuredEvent, featuredEventActive } from '$lib/derived/featured-event.derived';
	import { marketMetadata } from '$lib/derived/market-metadata.derived';
	import { marketTags } from '$lib/derived/market-tags.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { preferencesStore } from '$lib/stores/preferences.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import {
		DEFAULT_SECONDARY_FILTERS,
		type MarketSecondaryFilters
	} from '$lib/types/market-filters';
	import { isMarketSuggested } from '$lib/utils/flow-card-display.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { filterAndRankMarkets } from '$lib/utils/market-filters.utils';

	const SUGGESTED_RAIL_LIMIT = 6;

	let loading = $derived($marketsNotInitialized);

	let searchTerm = $state('');
	let activeTab = $state('Active');
	let filters = $state<MarketSecondaryFilters>({ ...DEFAULT_SECONDARY_FILTERS });
	let savedOnly = $state(false);

	let forkModalOpen = $state(false);
	let forkTarget = $state<Market | null>(null);

	const savedSet = $derived(new Set($preferencesStore.savedMarketIds));
	const savedCount = $derived(savedSet.size);

	const handleChallenge = (market: Market) => {
		forkTarget = market;
		forkModalOpen = true;
	};

	const tabs = ['Active', 'Trending', 'Expiring', 'Resolved'] as const;

	const tabLabel = (tab: (typeof tabs)[number]) => {
		const key =
			tab === 'Active'
				? 'markets.tab.active'
				: tab === 'Trending'
					? 'markets.tab.trending'
					: tab === 'Expiring'
						? 'markets.tab.expiring'
						: 'markets.tab.resolved';

		return t({ locale: $localeStore, key });
	};

	const baseFilteredMarkets = $derived(
		filterAndRankMarkets({
			markets: $markets,
			searchTerm,
			activeTab,
			filters,
			userInterests: $userStore.profile?.interests ?? [],
			tagMappings: $marketTags,
			metadataBySeries: $marketMetadata
		})
	);

	const filteredMarkets = $derived(
		savedOnly ? baseFilteredMarkets.filter((m) => savedSet.has(m.id)) : baseFilteredMarkets
	);

	// Editorial rail — only renders when at least one Open market is
	// currently flagged AND inside its 14-day decay window. Gating
	// goes through `isMarketSuggested` so the rail can never disagree
	// with the sort-tier boost: if a market would no longer be
	// boosted, it never shows up here either. Capped at
	// `SUGGESTED_RAIL_LIMIT` so the rail stays editorial, not a dump.
	const baseSuggestedRail = $derived(
		$markets.filter((market) => isMarketSuggested({ market, metadata: $marketMetadata[market.id] }))
	);

	// When a featured event is running, the rail narrows to markets
	// carrying the event's category tag so the curated picks track the
	// live tentpole. If nothing event-tagged is in the suggested set,
	// fall back to the regular editorial rail so the page never loses
	// the rail unexpectedly. Same `SUGGESTED_RAIL_LIMIT` cap either way.
	// `categoryTag` is typed as a free-form `string` on FeaturedEvent so
	// future tentpoles can use values that aren't in the closed
	// `MarketTag` enum — widen the per-market tag array to `string[]`
	// for the membership check rather than narrowing the event tag.
	const eventTag = $derived($featuredEvent.categoryTag);
	const eventRailItems = $derived(
		$featuredEventActive && eventTag !== undefined
			? baseSuggestedRail.filter((market) =>
					($marketTags[market.id] ?? []).some((tag) => (tag as string) === eventTag)
				)
			: []
	);
	const railIsEventScoped = $derived(eventRailItems.length > 0);
	const suggestedRail = $derived(
		(railIsEventScoped ? eventRailItems : baseSuggestedRail).slice(0, SUGGESTED_RAIL_LIMIT)
	);
</script>

{#snippet marketsTitle()}
	<h1 class="markets-mobile-title">{t({ locale: $localeStore, key: 'nav.markets' })}</h1>
	<span class="markets-mobile-live">{t({ locale: $localeStore, key: 'hero.live' })}</span>
{/snippet}

{#snippet marketsCount()}
	<strong class="markets-mobile-count num">{filteredMarkets.length}</strong>
{/snippet}

<section class="space-y-6">
	<MobileAppBar align="left" right={marketsCount} titleChildren={marketsTitle} />

	<div class="hidden md:block">
		<SectionHeader
			description={t({ locale: $localeStore, key: 'markets.page.sub' })}
			highlight={t({ locale: $localeStore, key: 'markets.eyebrow' })}
			title={t({ locale: $localeStore, key: 'markets.page.title' })}
		/>
	</div>

	<div class="w-full space-y-5">
		<!-- When the user has flipped the Saved filter on, the page is a
		     focused "my saved markets" view — the editorial rail
		     (suggested / event-scoped) is hidden so the surface matches
		     V1.2's saved-only mode where the saved cards are the only
		     thing on screen. Hiding the rail also avoids the visual
		     tension of an editorial pick competing with the user's own
		     bookmarks. -->
		{#if suggestedRail.length > 0 && !savedOnly}
			<section
				class="suggested-rail"
				aria-label={t({
					locale: $localeStore,
					key: railIsEventScoped ? 'markets.suggested.title_event' : 'markets.suggested.title',
					params: railIsEventScoped ? { event: $featuredEvent.title } : undefined
				})}
			>
				<header class="suggested-rail-head">
					<span class="eyebrow suggested-rail-eyebrow">
						{t({
							locale: $localeStore,
							key: railIsEventScoped
								? 'markets.suggested.eyebrow_event'
								: 'markets.suggested.eyebrow'
						})}
					</span>
					<h2 class="suggested-rail-title">
						{t({
							locale: $localeStore,
							key: railIsEventScoped ? 'markets.suggested.title_event' : 'markets.suggested.title',
							params: railIsEventScoped ? { event: $featuredEvent.title } : undefined
						})}
					</h2>
				</header>
				<div class="suggested-rail-scroller">
					{#each suggestedRail as market, index (market.id)}
						<div class="suggested-rail-card">
							<MarketCard
								{index}
								{market}
								metadata={$marketMetadata[market.id]}
								tag={primaryMarketTag($marketTags[market.id])}
							/>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<div class="space-y-5">
			<MarketFilters
				{activeTab}
				{filters}
				onFiltersChange={(f) => (filters = f)}
				onSearchChange={(term) => (searchTerm = term)}
				onTabChange={(tab) => (activeTab = tab)}
				{searchTerm}
				tabs={tabs.map((tab) => ({ id: tab, label: tabLabel(tab) }))}
			/>

			<!-- V1.2 Markets carries a heart-prefixed "Saved" filter chip
			     alongside the category chips. We expose it as a toggle next
			     to the list eyebrow so users can scope the list to their
			     hearted markets without disturbing the other filters. The
			     chip is hidden when the user hasn't saved any markets yet
			     to avoid surfacing a control with nothing to filter. -->
			<div class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-1">
				<div class="flex items-center gap-3">
					<h2 class="eyebrow">{tabLabel(activeTab as (typeof tabs)[number])}</h2>
					{#if savedCount > 0}
						<button
							class={[
								'duration-state ease-vici inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors',
								savedOnly
									? 'border-laurel/40 bg-laurel-glow text-laurel'
									: 'border-border text-muted-foreground hover:border-laurel/40 hover:text-laurel'
							]}
							aria-pressed={savedOnly}
							onclick={() => (savedOnly = !savedOnly)}
							type="button"
						>
							<Heart
								aria-hidden="true"
								fill={savedOnly ? 'currentColor' : 'none'}
								size={11}
								strokeWidth={2.2}
							/>
							{t({
								locale: $localeStore,
								key: 'markets.tab.saved',
								params: { count: savedCount }
							})}
						</button>
					{/if}
				</div>
				<span class="num text-muted-foreground text-xs font-bold">{filteredMarkets.length}</span>
			</div>

			<MarketFeed
				emptyMessage={t({ locale: $localeStore, key: 'markets.empty' })}
				{loading}
				markets={filteredMarkets}
				metadataBySeries={$marketMetadata}
				onChallenge={handleChallenge}
				tagsBySeries={$marketTags}
			/>
		</div>
	</div>

	<ForkMarketModal
		isOpen={forkModalOpen}
		market={forkTarget}
		onClose={() => (forkModalOpen = false)}
	/>
</section>

<style lang="postcss">
	.markets-mobile-title {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-24);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
	}

	.markets-mobile-live {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border-radius: var(--r-4);
		background: var(--no-wash);
		padding: 0.2rem 0.45rem;
		color: var(--no);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.markets-mobile-live::before {
		width: 0.3rem;
		height: 0.3rem;
		border-radius: var(--r-pill);
		background: currentColor;
		content: '';
	}

	.markets-mobile-count {
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	/* Editorial rail — horizontal-scroll row of fixed-width MarketCards.
	   Sits above the search/filter/tab block so the curated picks are the
	   first thing users see, without crowding the canonical list below.
	   The negative margins + padding pattern keeps the scroll-snap edges
	   flush with the page gutter while letting cards bleed past it. */
	.suggested-rail {
		margin: 0 auto;
		max-width: 56rem;
		padding: 0 1rem;
	}
	.suggested-rail-head {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-bottom: 0.75rem;
	}
	.suggested-rail-eyebrow {
		color: var(--laurel);
	}
	.suggested-rail-title {
		margin: 0;
		font-family: var(--font-display);
		font-size: var(--t-18);
		font-weight: 600;
		letter-spacing: var(--tracking-snug);
		color: var(--text-base);
	}
	.suggested-rail-scroller {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(17rem, 17rem);
		gap: 0.75rem;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		margin: 0 -1rem;
		padding: 0.25rem 1rem 0.5rem;
	}
	.suggested-rail-scroller::-webkit-scrollbar {
		display: none;
	}
	.suggested-rail-card {
		scroll-snap-align: start;
		min-width: 0;
	}
</style>
