<script lang="ts">
	import {
		MARKET_TAGS,
		MARKET_TAG_LABEL_KEYS,
		type MarketTag
	} from '$lib/constants/market-tags.constants';
	import { MarketWhyNowKind } from '$lib/enums/market-metadata';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		whyKind: MarketWhyNowKind;
		whyText: string;
		tags: MarketTag[];
		suggested: boolean;
		subtitle: string;
		isAdmin: boolean;
		onWhyKindChange: (value: MarketWhyNowKind) => void;
		onWhyTextChange: (value: string) => void;
		onTagsChange: (value: MarketTag[]) => void;
		onSuggestedChange: (value: boolean) => void;
		onSubtitleChange: (value: string) => void;
	}

	const {
		whyKind,
		whyText,
		tags,
		suggested,
		subtitle,
		isAdmin,
		onWhyKindChange,
		onWhyTextChange,
		onTagsChange,
		onSuggestedChange,
		onSubtitleChange
	}: Props = $props();

	const toggleTag = (tag: MarketTag) => {
		const next = tags.includes(tag) ? tags.filter((value) => value !== tag) : [...tags, tag];

		onTagsChange(MARKET_TAGS.filter((value) => next.includes(value)));
	};
</script>

<div class="market-metadata-grid">
	<label>
		<span>{t({ locale: $localeStore, key: 'market.metadata.why_now' })}</span>
		<select
			onchange={(e) => onWhyKindChange(e.currentTarget.value as MarketWhyNowKind)}
			value={whyKind}
		>
			{#each Object.values(MarketWhyNowKind) as kind (kind)}
				<option value={kind}>{kind}</option>
			{/each}
		</select>
		<input
			oninput={(e) => onWhyTextChange(e.currentTarget.value)}
			placeholder={t({
				locale: $localeStore,
				key: 'market.metadata.placeholder.closing_soon'
			})}
			value={whyText}
		/>
	</label>

	<label>
		<span>{t({ locale: $localeStore, key: 'market.metadata.subtitle' })}</span>
		<input
			maxlength="60"
			oninput={(e) => onSubtitleChange(e.currentTarget.value)}
			placeholder={t({
				locale: $localeStore,
				key: 'market.metadata.placeholder.subtitle'
			})}
			value={subtitle}
		/>
	</label>

	<div class="market-metadata-tags">
		<span class="market-metadata-tags-label">
			{t({ locale: $localeStore, key: 'market.metadata.tags' })}
		</span>
		<p class="market-metadata-tags-help">
			{t({ locale: $localeStore, key: 'market.metadata.tags_help' })}
		</p>
		<div class="market-metadata-tags-grid">
			{#each MARKET_TAGS as tag (tag)}
				{@const selected = tags.includes(tag)}
				<button
					class="market-metadata-tag-chip"
					class:selected
					aria-pressed={selected}
					onclick={() => toggleTag(tag)}
					type="button"
				>
					{t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[tag] })}
				</button>
			{/each}
		</div>
	</div>

	{#if isAdmin}
		<label class="market-metadata-toggle">
			<input
				checked={suggested}
				onchange={(e) => onSuggestedChange(e.currentTarget.checked)}
				type="checkbox"
			/>
			<span>
				<span class="market-metadata-toggle-title">
					{t({ locale: $localeStore, key: 'market.metadata.suggested' })}
				</span>
				<span class="market-metadata-toggle-help">
					{t({ locale: $localeStore, key: 'market.metadata.suggested_help' })}
				</span>
			</span>
		</label>
	{/if}
</div>

<style lang="postcss">
	.market-metadata-grid {
		display: grid;
		gap: 0.875rem;
		margin-bottom: 1rem;
	}

	.market-metadata-grid label {
		display: grid;
		gap: 0.4rem;
	}

	.market-metadata-grid label > span {
		color: var(--text-muted);
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.market-metadata-grid input,
	.market-metadata-grid select {
		width: 100%;
		border: 1px solid var(--border-base);
		border-radius: var(--r-8);
		background: var(--bg-surface);
		color: var(--text-base);
		padding: 0.65rem 0.75rem;
		font: inherit;
	}

	.market-metadata-toggle {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: 0.6rem;
	}

	.market-metadata-toggle input {
		width: 1.1rem;
		height: 1.1rem;
		margin-top: 0.15rem;
	}

	.market-metadata-toggle-title {
		display: block;
		color: var(--text-base);
		font-size: var(--t-14);
		font-weight: 600;
		letter-spacing: normal;
		text-transform: none;
	}

	.market-metadata-toggle-help {
		display: block;
		color: var(--text-muted);
		font-size: var(--t-12);
		font-weight: 400;
		letter-spacing: normal;
		text-transform: none;
		margin-top: 0.15rem;
	}

	.market-metadata-tags {
		display: grid;
		gap: 0.4rem;
	}

	.market-metadata-tags-label {
		color: var(--text-muted);
		font-size: var(--t-12);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.market-metadata-tags-help {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	.market-metadata-tags-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.market-metadata-tag-chip {
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill, 999px);
		background: var(--bg-surface);
		color: var(--text-base);
		padding: 0.35rem 0.8rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 500;
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.market-metadata-tag-chip:hover {
		border-color: var(--text-base);
	}

	.market-metadata-tag-chip.selected {
		background: var(--text-base);
		border-color: var(--text-base);
		color: var(--bg-surface);
	}
</style>
