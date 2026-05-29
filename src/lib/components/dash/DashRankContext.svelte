<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { EM_DASH } from '$lib/constants/app.constants';
	import type { MarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		topCategory: { id: MarketTag; label: string; acc: number } | undefined;
	}

	let { topCategory }: Props = $props();
</script>

<div class="dash-section">
	<div class="dash-section-eyebrow">
		<span>{t({ locale: $localeStore, key: 'dash.rank.eyebrow' })}</span>
	</div>
	<div class="dash-rank-grid">
		<div class="dash-rank-tile">
			<span class="lbl">{t({ locale: $localeStore, key: 'dash.rank.global' })}</span>
			<span class="v">{EM_DASH}</span>
			<span class="sub">{t({ locale: $localeStore, key: 'dash.rank.global_sub' })}</span>
		</div>
		<button
			class="dash-rank-tile dash-rank-tile-btn"
			onclick={() => goto(resolve(AppPath.Social))}
			type="button"
		>
			<span class="lbl">{t({ locale: $localeStore, key: 'dash.rank.league' })}</span>
			<span class="v">{EM_DASH}</span>
			<span class="sub">{t({ locale: $localeStore, key: 'dash.rank.league_sub' })}</span>
		</button>
		<div class="dash-rank-tile">
			<span class="lbl">
				{#if topCategory}{topCategory.label}{:else}{t({
						locale: $localeStore,
						key: 'dash.rank.top_cat'
					})}{/if}
			</span>
			<span class="v acc">
				{#if topCategory}{Math.round(topCategory.acc * 100)}%{:else}{EM_DASH}{/if}
			</span>
			<span class="sub">{t({ locale: $localeStore, key: 'dash.rank.top_cat_sub' })}</span>
		</div>
	</div>
</div>
