<script lang="ts" module>
	import {
		MARKET_TAGS,
		MARKET_TAG_LABEL_KEYS,
		type MarketTag
	} from '$lib/constants/market-tags.constants';

	/**
	 * Filter key drives both the `MarketTag` taxonomy and two
	 * out-of-band buckets — `all` (no filtering) and `saved` (heart
	 * chip). Kept as a union so the page-level state stays strongly
	 * typed without an enum.
	 */
	export type MarketsCategoryFilter = 'all' | 'saved' | MarketTag;
</script>

<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Horizontally-scrolling chip rail for the Markets screen: a leading
	 * "♥ Saved · N" chip, then "All", then one chip per category. Active
	 * filter is highlighted; tapping a chip fires `onChange`.
	 *
	 * In World-Cup-focus mode the rail opens collapsed — Saved · All ·
	 * World Cup · "More markets →" — and the remaining categories stay
	 * hidden until the user taps "More markets →", which reveals the full
	 * taxonomy. The leading buckets (Saved · All) are always visible so
	 * the user can never lose their saves behind the focus collapse.
	 */
	interface Props {
		active: MarketsCategoryFilter;
		savedCount: number;
		onChange: (filter: MarketsCategoryFilter) => void;
		/**
		 * Tags that resolve to at least one market right now. Chips for tags
		 * outside this set are hidden so users don't pick a category that
		 * would render an empty list — except the currently-active chip,
		 * which we always keep visible to avoid the rail jumping when the
		 * user toggles filters.
		 */
		availableTags?: ReadonlySet<MarketTag>;
		/**
		 * World-Cup-focus mode. When set, the category chips collapse behind
		 * "More markets →" (only `wc` is shown until the user expands). The
		 * Saved and All buckets stay visible either way.
		 */
		wcFocus?: boolean;
	}

	const { active, savedCount, onChange, availableTags, wcFocus = false }: Props = $props();

	// Collapsed until the user reveals the rest of the deck. Only relevant in
	// `wcFocus` mode; ignored otherwise.
	let expanded = $state(false);

	const visibleTags = $derived(
		availableTags === undefined
			? MARKET_TAGS
			: MARKET_TAGS.filter((tag) => availableTags.has(tag) || active === tag)
	);

	// In focus mode collapse to the World Cup chip alone; the rest of the
	// categories return once "More markets →" expands the rail.
	const categoryTags = $derived(
		wcFocus && !expanded ? visibleTags.filter((tag) => tag === 'wc') : visibleTags
	);

	// "More markets →" only appears while the rail is collapsed in focus mode.
	const showMore = $derived(wcFocus && !expanded);
</script>

<div
	style="display: flex; gap: 6px; padding: 4px 20px 14px; overflow-x: auto;"
	class="no-scrollbar"
>
	<button
		class={`chip ${active === 'saved' ? 'active' : ''}`}
		onclick={() => onChange('saved')}
		type="button"
	>
		<span style="margin-right: 4px;" aria-hidden="true">♥</span>
		<span
			>{t({ locale: $localeStore, key: 'markets.tab.saved_label' })}{savedCount > 0
				? ` · ${savedCount}`
				: ''}</span
		>
	</button>
	<button
		class={`chip ${active === 'all' ? 'active' : ''}`}
		onclick={() => onChange('all')}
		type="button">{t({ locale: $localeStore, key: 'markets.chip.all' })}</button
	>
	{#each categoryTags as tag (tag)}
		<button
			class={`chip ${active === tag ? 'active' : ''}`}
			onclick={() => onChange(tag)}
			type="button">{t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[tag] })}</button
		>
	{/each}
	{#if showMore}
		<button class="chip" onclick={() => (expanded = true)} type="button"
			>{t({ locale: $localeStore, key: 'markets.more' })} →</button
		>
	{/if}
</div>
