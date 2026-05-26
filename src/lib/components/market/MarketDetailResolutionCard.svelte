<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { formatDate } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	const closesLabel = $derived(formatDate(market.expiryDate));
</script>

<!-- Resolution rules inline card — port of `screens.jsx:262-267`. The
     body either renders the market's own description (the canonical
     source of resolution criteria authored by the market creator) or
     falls back to a templated sentence referencing the close date and
     official-source verbiage. Position-wise this card sits directly
     below the stats grid, replacing the old `Description` tab + the
     duplicate hero description. -->
<div class="market-resolution-card">
	<span class="market-resolution-eyebrow">
		{t({ locale: $localeStore, key: 'market.detail.resolution.eyebrow' })}
	</span>
	<p class="market-resolution-body">
		{#if market.description !== ''}
			{market.description}
		{:else}
			{t({
				locale: $localeStore,
				key: 'market.detail.resolution.fallback',
				params: { closesAt: closesLabel }
			})}
		{/if}
	</p>
</div>

<style lang="postcss">
	.market-resolution-card {
		margin: 0.5rem 1.25rem;
		padding: 1rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		box-shadow: var(--inset-hi);
	}

	.market-resolution-eyebrow {
		display: block;
		color: var(--text-muted);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.market-resolution-body {
		margin: 0.5rem 0 0;
		color: var(--text-base);
		font-size: var(--t-13);
		line-height: 1.55;
	}
</style>
