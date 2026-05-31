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

	/**
	 * Fixed-width (280 px) market card used in the Saved / Trending
	 * rails on the markets page. Header row carries the category tag
	 * + volume; body is the question; footer pairs the YES % with
	 * `YES / NO` mini-tags above a `ProbBar`.
	 */
	interface Props {
		market: Market;
		tag?: MarketTag;
	}

	const { market, tag }: Props = $props();

	const yes = $derived(Math.round(market.yesProbability * 100));
	const vol = $derived(
		formatVolume({
			volume: market.totalVolume,
			decimals: market.token.decimals,
			symbol: market.token.symbol
		})
	);

	const onClick = () => goto(resolve(`${AppPath.Markets}/${market.id}`));
</script>

<div
	style="flex: 0 0 280px; cursor: pointer; gap: 0; background: linear-gradient(180deg, var(--bg-surface), var(--bg-base));"
	class="card-surface"
	onclick={onClick}
	onkeydown={(event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onClick();
		}
	}}
	role="button"
	tabindex="0"
>
	<div class="row between">
		{#if tag}
			<span style:color={tagColor(tag)} class="tag"
				>{t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[tag] }).toUpperCase()}</span
			>
		{:else}
			<span class="tag">&nbsp;</span>
		{/if}
		<span class="num mute t-eyebrow">{vol}</span>
	</div>
	<div
		style="margin-top: 12px; font-size: 15px; font-weight: 600; line-height: 1.3; min-height: 58px;"
	>
		{market.title}
	</div>
	<div style="margin-top: 14px;" class="row between">
		<span style:color="var(--yes)" style:font-weight="600" class="num yes t-h4">{yes}%</span>
		<span style="gap: 4px;" class="row">
			<span class="tag yes">{t({ locale: $localeStore, key: 'outcome.yes' })}</span>
			<span class="tag no">{t({ locale: $localeStore, key: 'outcome.no' })}</span>
		</span>
	</div>
	<div style="margin-top: 8px;">
		<div class="probbar">
			<i
				style:width="{yes}%"
				style:background={yes >= 50
					? undefined
					: 'linear-gradient(90deg, var(--no-deep), var(--no))'}
			></i>
		</div>
	</div>
</div>
