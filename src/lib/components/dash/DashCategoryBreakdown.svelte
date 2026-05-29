<script lang="ts">
	import type { MarketTag } from '$lib/constants/market-tags.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		catRows: { id: MarketTag; label: string; acc: number }[];
	}

	let { catRows }: Props = $props();
</script>

<div class="dash-section">
	<div class="dash-section-eyebrow">
		<span>{t({ locale: $localeStore, key: 'dash.categories.eyebrow' })}</span>
	</div>
	{#if catRows.length === 0}
		<div class="dash-empty">
			{t({ locale: $localeStore, key: 'dash.placeholder.categories' })}
		</div>
	{:else}
		{#each catRows as r (r.id)}
			{@const pct = Math.round(r.acc * 100)}
			<div class="dash-cat-row">
				<span class="name">{r.label}</span>
				<div class="bar"><span style:width="{pct}%" class="fill"></span></div>
				<span class="pct">{pct}%</span>
			</div>
		{/each}
	{/if}
</div>
