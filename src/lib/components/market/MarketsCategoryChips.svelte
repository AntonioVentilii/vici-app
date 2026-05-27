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
	 * Horizontally-scrolling chip rail for the Markets page: a leading
	 * "♥ Saved · N" chip followed by one chip per category. Active
	 * filter is highlighted; tapping a chip fires `onChange`.
	 */
	interface Props {
		active: MarketsCategoryFilter;
		savedCount: number;
		onChange: (filter: MarketsCategoryFilter) => void;
	}

	const { active, savedCount, onChange }: Props = $props();
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
	{#each MARKET_TAGS as tag (tag)}
		<button
			class={`chip ${active === tag ? 'active' : ''}`}
			onclick={() => onChange(tag)}
			type="button">{t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[tag] })}</button
		>
	{/each}
</div>
