<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
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
	import { marketTags, marketTagsNotInitialized } from '$lib/derived/market-tags.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { preferencesStore } from '$lib/stores/preferences.store';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Markets screen — chip rail (Saved + per-category) above a
	 * Trending carousel and a sortable list. Data comes from the
	 * `$markets` derived store plus
	 * `$preferencesStore.savedMarketIds`; the saved-ids persistence
	 * is keyed under `vici.saved-markets` in localStorage.
	 */
	const TRENDING_LIMIT = 8;
	const SAVED_RAIL_LIMIT = 6;
	const SORT_STORAGE_KEY = 'vici.markets-sort';

	type MarketsSort = 'trending' | 'closing' | 'newest';
	const SORT_OPTIONS: MarketsSort[] = ['trending', 'closing', 'newest'];
	const isMarketsSort = (v: string): v is MarketsSort =>
		(SORT_OPTIONS as readonly string[]).includes(v);
	const initialSort = ((): MarketsSort => {
		if (typeof localStorage === 'undefined') {
			return 'trending';
		}

		try {
			const stored = localStorage.getItem(SORT_STORAGE_KEY);

			return stored !== null && isMarketsSort(stored) ? stored : 'trending';
		} catch {
			return 'trending';
		}
	})();

	let cat = $state<MarketsCategoryFilter>('all');
	let sort = $state<MarketsSort>(initialSort);

	const setSort = (next: MarketsSort) => {
		sort = next;

		if (typeof localStorage === 'undefined') {
			return;
		}

		try {
			localStorage.setItem(SORT_STORAGE_KEY, next);
		} catch {
			// localStorage write blocked — accept the loss; the user's
			// preference will just not persist for this device.
		}
	};

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

	// Sort comparator for the main list. `trending` mirrors the
	// homepage carousel's totalVolume DESC sort; `closing` surfaces the
	// soonest-expiring Open markets first (Resolved/Expired sink to
	// the bottom); `newest` sorts by `Market.createdAt` DESC — same
	// field the recommendation ranker uses as its recency signal
	// (`market.services.ts:600`).
	const sortList = ({ items, mode }: { items: Market[]; mode: MarketsSort }): Market[] => {
		const copy = [...items];

		switch (mode) {
			case 'trending':
				return copy.sort((a, b) => {
					if (b.totalVolume === a.totalVolume) {
						return 0;
					}

					return b.totalVolume > a.totalVolume ? 1 : -1;
				});
			case 'closing':
				return copy.sort((a, b) => {
					const aOpen = a.status === 'Open' ? 0 : 1;
					const bOpen = b.status === 'Open' ? 0 : 1;

					if (aOpen !== bOpen) {
						return aOpen - bOpen;
					}

					if (a.expiryDate === b.expiryDate) {
						return 0;
					}

					return a.expiryDate < b.expiryDate ? -1 : 1;
				});
			case 'newest':
				return copy.sort((a, b) => {
					if (a.createdAt === b.createdAt) {
						return 0;
					}

					return b.createdAt > a.createdAt ? 1 : -1;
				});
		}
	};

	// Filter the deck: saved-only when the saved chip is active,
	// otherwise either all open markets or those carrying the active
	// category tag. The result is sorted via `sortList` below.
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

		return sortList({ items: base, mode: sort });
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
		{availableTags}
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

		<!-- Sort chips — Trending (default, volume DESC) · Closing soon
		     (Open-first, expiry ASC) · Newest (expiry DESC as a freshness
		     proxy). Persisted under `vici.markets-sort`. -->
		<div
			class="markets-sort"
			aria-label={t({ locale: $localeStore, key: 'markets.sort.label' })}
			role="tablist"
		>
			{#each SORT_OPTIONS as option (option)}
				<button
					class="markets-sort-chip"
					class:is-active={sort === option}
					aria-selected={sort === option}
					onclick={() => setSort(option)}
					role="tab"
					type="button"
				>
					{t({ locale: $localeStore, key: `markets.sort.${option}` })}
				</button>
			{/each}
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

<style lang="postcss">
	.markets-sort {
		display: flex;
		gap: 0.5rem;
		padding: 0 1.25rem 0.75rem;
		flex-wrap: wrap;
	}

	.markets-sort-chip {
		appearance: none;
		background: transparent;
		border: 1px solid var(--border-base);
		color: var(--text-mute);
		border-radius: 999px;
		font: inherit;
		font-size: 12px;
		letter-spacing: 0.02em;
		padding: 0.35rem 0.85rem;
		cursor: pointer;
		transition:
			color var(--d-hover) ease,
			border-color var(--d-hover) ease,
			background-color var(--d-hover) ease;
	}

	.markets-sort-chip:hover {
		color: var(--text-base);
		border-color: var(--text-mute);
	}

	.markets-sort-chip.is-active {
		color: var(--color-primary);
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}
</style>
