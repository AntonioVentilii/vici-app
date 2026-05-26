<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { MARKET_TAG_LABEL_KEYS, type MarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { formatVolume } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';

	interface Props {
		market: Market;
		tag?: MarketTag;
	}

	const { market, tag }: Props = $props();

	const yesPct = $derived(Math.round(market.yesProbability * 100));
	const noPct = $derived(Math.max(0, 100 - yesPct));
	const volume = $derived(
		formatVolume({
			volume: market.totalVolume,
			decimals: market.token.decimals,
			symbol: market.token.symbol
		})
	);

	const onActivate = () => goto(resolve(`${AppPath.Markets}/${market.id}`));
</script>

<button class="markets-featured-card" onclick={onActivate} type="button">
	<div class="markets-featured-head">
		{#if tag}
			<span style:color={tagColor(tag)} class="markets-featured-tag eyebrow-xs">
				{t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[tag] })}
			</span>
		{:else}
			<span class="markets-featured-tag eyebrow-xs">&nbsp;</span>
		{/if}
		<span class="num markets-featured-vol">{volume}</span>
	</div>

	<p class="markets-featured-q">{market.title}</p>

	<div class="markets-featured-foot">
		<span class="num markets-featured-yes" class:is-no={yesPct < 50}>{yesPct}%</span>
		<div class="markets-featured-pair">
			<span class="tag-yes eyebrow-xs">{t({ locale: $localeStore, key: 'outcome.yes' })}</span>
			<span class="tag-no eyebrow-xs">{t({ locale: $localeStore, key: 'outcome.no' })}</span>
		</div>
	</div>

	<div class="markets-featured-bar" aria-hidden="true">
		<span style:width="{yesPct}%" class="markets-featured-bar-fill"></span>
	</div>
	<span class="sr-only">YES {yesPct}% · NO {noPct}%</span>
</button>

<style lang="postcss">
	.markets-featured-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 17.5rem;
		flex-shrink: 0;
		scroll-snap-align: start;
		text-align: left;
		border: 1px solid var(--border-base);
		border-radius: var(--r-16);
		background: linear-gradient(180deg, var(--bg-elevated, var(--bg-surface)), var(--bg-surface));
		padding: 0.875rem;
		box-shadow: inset 0 1px 0 color-mix(in srgb, var(--parchment) 4%, transparent);
		cursor: pointer;
		transition:
			border-color var(--d-hover) var(--ease-vici),
			background-color var(--d-hover) var(--ease-vici);
	}

	.markets-featured-card:hover {
		border-color: var(--border-strong);
	}

	.markets-featured-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.markets-featured-tag {
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.markets-featured-vol {
		color: var(--text-muted);
		font-size: var(--t-11);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
	}

	.markets-featured-q {
		margin: 0;
		min-height: 3.25rem;
		color: var(--text-base);
		font-size: var(--t-15);
		font-weight: 600;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.markets-featured-foot {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.markets-featured-yes {
		color: var(--yes);
		font-size: var(--t-18);
		font-weight: 600;
	}

	.markets-featured-yes.is-no {
		color: var(--no);
	}

	.markets-featured-pair {
		display: inline-flex;
		gap: 0.25rem;
	}

	.tag-yes,
	.tag-no {
		display: inline-flex;
		align-items: center;
		border-radius: 4px;
		padding: 0.15rem 0.4rem;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.tag-yes {
		background: var(--yes-wash);
		color: var(--yes);
	}

	.tag-no {
		background: var(--no-wash);
		color: var(--no);
	}

	.markets-featured-bar {
		position: relative;
		height: 0.5rem;
		border-radius: var(--r-pill);
		background: var(--no-wash);
		overflow: hidden;
	}

	.markets-featured-bar-fill {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, color-mix(in srgb, var(--yes) 70%, black), var(--yes));
	}
</style>
