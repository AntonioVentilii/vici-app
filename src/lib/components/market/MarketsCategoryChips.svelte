<script lang="ts">
	import { Bitcoin, Heart, LandPlot, Landmark, Sparkles, Trophy, Wand2 } from 'lucide-svelte/icons';
	import { MARKET_TAGS, type MarketTag } from '$lib/constants/market-tags.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';

	/**
	 * Filter key drives both the `MarketTag` taxonomy and two
	 * out-of-band buckets — `all` (no filtering) and `saved` (heart
	 * chip). Kept as a union so the page-level state stays strongly
	 * typed without an enum.
	 */
	export type MarketsCategoryFilter = 'all' | 'saved' | MarketTag;

	interface Props {
		active: MarketsCategoryFilter;
		savedCount: number;
		onChange: (filter: MarketsCategoryFilter) => void;
	}

	const { active, savedCount, onChange }: Props = $props();

	// Per-category glyph. Lucide stand-ins for the prototype's emoji /
	// bespoke flow-art marks — keep the visual cue but stay inside the
	// existing icon system so stroke / size are uniform across surfaces.
	const TAG_ICONS: Record<MarketTag, typeof LandPlot> = {
		macro: LandPlot,
		crypto: Bitcoin,
		politics: Landmark,
		tech: Wand2,
		sports: Trophy,
		culture: Sparkles
	};

	const labelKey = (tag: MarketTag) => `market.tag.${tag}` as const;
</script>

<div class="markets-chips no-scrollbar" aria-label="Categories" role="tablist">
	<button
		class="markets-chip"
		class:is-active={active === 'saved'}
		aria-selected={active === 'saved'}
		onclick={() => onChange('saved')}
		role="tab"
		type="button"
	>
		<Heart
			aria-hidden="true"
			fill={active === 'saved' ? 'currentColor' : 'none'}
			size={12}
			strokeWidth={2.2}
		/>
		<span>{t({ locale: $localeStore, key: 'markets.tab.saved_label' })}</span>
		{#if savedCount > 0}
			<span class="num markets-chip-count">· {savedCount}</span>
		{/if}
	</button>

	<button
		class="markets-chip"
		class:is-active={active === 'all'}
		aria-selected={active === 'all'}
		onclick={() => onChange('all')}
		role="tab"
		type="button"
	>
		{t({ locale: $localeStore, key: 'markets.chip.all' })}
	</button>

	{#each MARKET_TAGS as tag (tag)}
		{@const Icon = TAG_ICONS[tag]}
		{@const isActive = active === tag}
		<button
			style:--chip-accent={tagColor(tag)}
			class="markets-chip"
			class:is-active={isActive}
			aria-selected={isActive}
			onclick={() => onChange(tag)}
			role="tab"
			type="button"
		>
			<Icon aria-hidden="true" size={12} strokeWidth={2.2} />
			<span>{t({ locale: $localeStore, key: labelKey(tag) })}</span>
		</button>
	{/each}
</div>

<style lang="postcss">
	.markets-chips {
		display: flex;
		gap: 0.375rem;
		padding: 0.25rem 0 0.5rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.markets-chips::-webkit-scrollbar {
		display: none;
	}

	.markets-chip {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
		padding: 0.375rem 0.75rem;
		color: var(--text-muted);
		font-size: var(--t-12);
		font-weight: 500;
		letter-spacing: 0;
		white-space: nowrap;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	.markets-chip:hover {
		border-color: var(--border-strong);
		color: var(--text-base);
	}

	.markets-chip.is-active {
		background: var(--laurel-glow);
		border-color: color-mix(in srgb, var(--color-primary) 30%, var(--border-base));
		color: var(--color-primary);
	}

	/* When a per-category accent is set (the 6 tag chips), the active
	   pill blends to that hue instead of the laurel primary — matches
	   the prototype's per-category color cue. */
	.markets-chip[style*='--chip-accent'].is-active {
		background: color-mix(in srgb, var(--chip-accent) 14%, transparent);
		border-color: color-mix(in srgb, var(--chip-accent) 38%, var(--border-base));
		color: var(--chip-accent);
	}

	.markets-chip-count {
		color: inherit;
		opacity: 0.85;
		font-size: var(--t-11);
	}
</style>
