<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { MARKET_TAG_LABEL_KEYS, type MarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { formatVolume } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { getTimeRemaining } from '$lib/utils/market.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';

	interface Props {
		market: Market;
		tag?: MarketTag;
	}

	const { market, tag }: Props = $props();

	const yesPct = $derived(Math.round(market.yesProbability * 100));
	const volume = $derived(
		formatVolume({
			volume: market.totalVolume,
			decimals: market.token.decimals,
			symbol: market.token.symbol
		})
	);
	const closes = $derived(getTimeRemaining(market.expiryDate));
	const goDetail = () => goto(resolve(`${AppPath.Markets}/${market.id}`));
</script>

<button class="markets-list-row" onclick={goDetail} type="button">
	<div class="markets-list-row-head">
		{#if tag}
			<span style:color={tagColor(tag)} class="markets-list-row-tag eyebrow-xs">
				{t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[tag] })}
			</span>
		{/if}
		<span class="num markets-list-row-meta">{volume} · {closes}</span>
	</div>

	<p class="markets-list-row-q">{market.title}</p>

	<div class="markets-list-row-foot">
		<div class="markets-list-row-bar" aria-hidden="true">
			<span style:width="{yesPct}%" class="markets-list-row-bar-fill"></span>
		</div>
		<span class="num markets-list-row-pct" class:is-no={yesPct < 50}>{yesPct}%</span>
	</div>
</button>

<style lang="postcss">
	.markets-list-row {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		text-align: left;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: var(--bg-surface);
		padding: 0.875rem;
		cursor: pointer;
		box-shadow: inset 0 1px 0 color-mix(in srgb, var(--parchment) 3%, transparent);
		transition:
			border-color var(--d-hover) var(--ease-vici),
			background-color var(--d-hover) var(--ease-vici);
	}

	.markets-list-row:hover {
		border-color: var(--border-strong);
		background: color-mix(in srgb, var(--bg-surface) 92%, var(--parchment) 8%);
	}

	.markets-list-row-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.markets-list-row-tag {
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.markets-list-row-meta {
		color: var(--text-muted);
		font-size: var(--t-11);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
	}

	.markets-list-row-q {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-15);
		font-weight: 600;
		line-height: 1.35;
	}

	.markets-list-row-foot {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.markets-list-row-bar {
		position: relative;
		flex: 1;
		height: 0.5rem;
		border-radius: var(--r-pill);
		background: var(--no-wash);
		overflow: hidden;
	}

	.markets-list-row-bar-fill {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, color-mix(in srgb, var(--yes) 70%, black), var(--yes));
	}

	.markets-list-row-pct {
		color: var(--yes);
		font-size: var(--t-14);
		font-weight: 600;
	}

	.markets-list-row-pct.is-no {
		color: var(--no);
	}
</style>
