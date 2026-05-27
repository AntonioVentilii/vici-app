<script lang="ts">
	/**
	 * Markets browse page. Public route: any visitor (signed in or
	 * not) can browse the list and open a market's detail; the
	 * `(app)/+layout` auth gate exempts `/markets` + `/markets/[id]`
	 * from the signin bounce. Auth-requiring affordances (placing a
	 * call, saving long-term) bounce to `/signin` at the point of
	 * action.
	 *
	 * Layout:
	 *  - appbar with the page title
	 *  - horizontal category chips, led by a `Saved` chip with a count,
	 *    then `All`, then every `MarketTag` from the closed taxonomy
	 *  - on the "All" view only: a Saved carousel (when the user has
	 *    saves) and a Trending carousel (top-N by `totalVolume`, the
	 *    closest live signal we have without a curated "hot" flag)
	 *  - filtered list with a counter, or a saved-empty state when the
	 *    Saved chip is active and there are no saves
	 */
	import MarketCard from '$lib/components/market/MarketCard.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import {
		MARKET_TAGS,
		MARKET_TAG_LABEL_KEYS,
		type MarketTag
	} from '$lib/constants/market-tags.constants';
	import { marketTags } from '$lib/derived/market-tags.derived';
	import { markets } from '$lib/derived/markets.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { preferencesStore } from '$lib/stores/preferences.store';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

	type Cat = 'all' | 'saved' | MarketTag;

	const TRENDING_LIMIT = 6;
	const SAVED_CAROUSEL_LIMIT = 6;

	let cat = $state<Cat>('all');

	const savedIds = $derived(new Set($preferencesStore.savedMarketIds));
	const tagsBySeries = $derived($marketTags);

	const savedMarkets = $derived($markets.filter((m) => savedIds.has(m.id)));

	const matchesCat = ({ market, c }: { market: Market; c: Cat }): boolean => {
		if (c === 'all') {
			return true;
		}

		if (c === 'saved') {
			return savedIds.has(market.id);
		}

		return (tagsBySeries[market.id] ?? []).includes(c);
	};

	const filteredList = $derived($markets.filter((m) => matchesCat({ market: m, c: cat })));

	// Trending heuristic — top-N by `totalVolume`. Real market docs
	// don't carry a curated `hot` boolean, so we surface activity as
	// the next-best signal.
	const trending = $derived(
		[...$markets]
			.sort((a, b) => {
				const diff = b.totalVolume - a.totalVolume;

				return diff > ZERO ? 1 : diff < ZERO ? -1 : 0;
			})
			.slice(0, TRENDING_LIMIT)
	);

	const sectionTitleKey = $derived(
		cat === 'all'
			? 'markets.section.all'
			: cat === 'saved'
				? 'markets.section.saved'
				: MARKET_TAG_LABEL_KEYS[cat]
	);
</script>

<svelte:head>
	<title>{t({ locale: $localeStore, key: 'nav.markets' })} · VICI</title>
</svelte:head>

<!-- The scroll viewport is owned by `(app)/+layout.svelte`'s
     `<main class="screen-scroll">` — adding `screen-scroll` here would
     nest a second scroller and double-stack the bottom-nav clearance. -->
<div class="markets-page">
	<header class="markets-appbar">
		<h2 class="markets-title">{t({ locale: $localeStore, key: 'nav.markets' })}</h2>
	</header>

	<!-- Category chips. `Saved` leads, then `All`, then every tag in
	     the closed taxonomy. -->
	<div class="markets-chips no-scrollbar">
		<button
			class="markets-chip"
			class:is-active={cat === 'saved'}
			onclick={() => (cat = 'saved')}
			type="button"
		>
			<span aria-hidden="true">♥</span>
			{t({
				locale: $localeStore,
				key: savedMarkets.length > 0 ? 'markets.tab.saved' : 'markets.tab.saved_label',
				params: { count: savedMarkets.length }
			})}
		</button>
		<button
			class="markets-chip"
			class:is-active={cat === 'all'}
			onclick={() => (cat = 'all')}
			type="button"
		>
			{t({ locale: $localeStore, key: 'markets.chip.all' })}
		</button>
		{#each MARKET_TAGS as tag (tag)}
			<button
				class="markets-chip"
				class:is-active={cat === tag}
				onclick={() => (cat = tag)}
				type="button"
			>
				{t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[tag] })}
			</button>
		{/each}
	</div>

	{#if cat === 'all' && savedMarkets.length > 0}
		<section class="markets-section">
			<div class="markets-section-h">
				<h3 class="markets-section-title">
					{t({ locale: $localeStore, key: 'markets.section.saved' })}
				</h3>
				<button class="markets-section-more" onclick={() => (cat = 'saved')} type="button">
					{t({
						locale: $localeStore,
						key: 'markets.see_all_count',
						params: { count: savedMarkets.length }
					})}
				</button>
			</div>
			<div class="markets-hscroll no-scrollbar">
				{#each savedMarkets.slice(0, SAVED_CAROUSEL_LIMIT) as m (m.id)}
					<div class="markets-card-shell">
						<MarketCard market={m} tag={tagsBySeries[m.id]?.[0]} />
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if cat === 'all' && trending.length > 0}
		<section class="markets-section">
			<div class="markets-section-h">
				<h3 class="markets-section-title">
					{t({ locale: $localeStore, key: 'markets.section.trending' })}
				</h3>
				<span class="markets-section-more">
					{t({ locale: $localeStore, key: 'markets.see_all' })}
				</span>
			</div>
			<div class="markets-hscroll no-scrollbar">
				{#each trending as m (m.id)}
					<div class="markets-card-shell">
						<MarketCard market={m} tag={tagsBySeries[m.id]?.[0]} />
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if cat === 'saved' && filteredList.length === 0}
		<div class="markets-saved-empty">
			<div class="markets-saved-empty-icon" aria-hidden="true">♥</div>
			<p class="markets-saved-empty-title serif-italic">
				{t({ locale: $localeStore, key: 'markets.saved_empty.title' })}
			</p>
			<p class="markets-saved-empty-body">
				{t({ locale: $localeStore, key: 'markets.saved_empty.body' })}
			</p>
		</div>
	{:else}
		<section class="markets-section">
			<div class="markets-section-h">
				<h3 class="markets-section-title">
					{t({ locale: $localeStore, key: sectionTitleKey })}
				</h3>
				<span class="markets-section-count num">{filteredList.length}</span>
			</div>
			<div class="markets-list">
				{#each filteredList as m, i (m.id)}
					<MarketCard index={i} market={m} tag={tagsBySeries[m.id]?.[0]} />
				{/each}
			</div>
		</section>
	{/if}
</div>

<style lang="postcss">
	.markets-page {
		padding-bottom: 6rem;
	}

	.markets-appbar {
		padding: 1rem 1.25rem 0.25rem;
	}

	.markets-title {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text-base);
	}

	.markets-chips {
		display: flex;
		gap: 0.375rem;
		padding: 0.25rem 1.25rem 0.875rem;
		overflow-x: auto;
	}

	.markets-chip {
		appearance: none;
		flex-shrink: 0;
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			border-color 160ms var(--ease-vici),
			background 160ms var(--ease-vici),
			color 160ms var(--ease-vici);
	}

	.markets-chip:hover {
		border-color: var(--border-strong);
		color: var(--text-base);
	}

	.markets-chip.is-active {
		background: var(--text-base);
		color: var(--bg-base);
		border-color: var(--text-base);
	}

	.markets-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 0.25rem;
		padding-bottom: 1rem;
	}

	.markets-section-h {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0 1.25rem;
	}

	.markets-section-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-base);
	}

	.markets-section-more {
		appearance: none;
		background: none;
		border: 0;
		color: var(--accent);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.markets-section-count {
		font-size: 0.8125rem;
		color: var(--text-muted);
	}

	.markets-hscroll {
		display: flex;
		gap: 0.75rem;
		padding: 0.25rem 1.25rem 0.5rem;
		overflow-x: auto;
	}

	.markets-card-shell {
		flex-shrink: 0;
		width: 17rem;
	}

	.markets-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0 1.25rem;
	}

	.markets-saved-empty {
		margin: 1rem 1.25rem 1.5rem;
		padding: 2rem 1.4rem;
		background: color-mix(in srgb, var(--text-base) 2%, transparent);
		border: 1px dashed var(--border-base);
		border-radius: 0.875rem;
		text-align: center;
	}

	.markets-saved-empty-icon {
		font-size: 2rem;
		opacity: 0.4;
		margin-bottom: 0.5rem;
	}

	.markets-saved-empty-title {
		margin: 0 0 0.375rem;
		font-size: 1.0625rem;
		color: var(--accent);
	}

	.markets-saved-empty-body {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--text-muted);
	}
</style>
