<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ProbBar from '$lib/components/ui/ProbBar.svelte';
	import { categoryLabel, type MarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { formatToken } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';

	/**
	 * Compact inline row in the Markets list. Rendered as a flush
	 * `card-inline` (hairline-top separator, no card border) so a column
	 * of rows reads as one list. Header pairs the category tag with
	 * `vol · closes`; body is the question; footer sits a `ProbBar`
	 * (shared `ui/ProbBar`) next to the YES %, tinted YES / NO by side.
	 */
	interface Props {
		market: Market;
		tag?: MarketTag;
	}

	const { market, tag }: Props = $props();

	const yes = $derived(Math.round(market.yesProbability * 100));
	const vol = $derived(formatToken({ value: market.totalVolume, unitName: market.token.decimals }));
	const closes = $derived(
		new Date(Number(market.expiryDate)).toLocaleDateString($localeStore, {
			month: 'short',
			day: 'numeric'
		})
	);

	const onClick = () => goto(resolve(`${AppPath.Markets}/${market.id}`));
</script>

<button class="card-inline" onclick={onClick} type="button">
	<div class="row between">
		{#if tag}
			<span style:color={tagColor(tag)} class="tag"
				>{categoryLabel({ category: tag, variant: 'short', locale: $localeStore })}</span
			>
		{:else}
			<span class="tag">&nbsp;</span>
		{/if}
		<span class="num mute t-eyebrow"
			>{vol} {t({ locale: $localeStore, key: 'market.vol_suffix' })} · {closes}</span
		>
	</div>
	<div style="margin-top: 8px; font-weight: 600; line-height: 1.35;" class="t-body">
		{market.title}
	</div>
	<div style="margin-top: 12px; gap: 12px;" class="row between">
		<div style="flex: 1;">
			<ProbBar {yes} />
		</div>
		<span style:color={yes >= 50 ? 'var(--yes)' : 'var(--no)'} class="num t-body fw-600"
			>{yes}%</span
		>
	</div>
</button>
