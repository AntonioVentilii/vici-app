<script lang="ts">
	import { MarketWhyNowKind } from '$lib/enums/market-metadata';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		whyKind: MarketWhyNowKind;
		whyText: string;
		suggested: boolean;
		isAdmin: boolean;
		onWhyKindChange: (value: MarketWhyNowKind) => void;
		onWhyTextChange: (value: string) => void;
		onSuggestedChange: (value: boolean) => void;
	}

	const {
		whyKind,
		whyText,
		suggested,
		isAdmin,
		onWhyKindChange,
		onWhyTextChange,
		onSuggestedChange
	}: Props = $props();
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
</style>
