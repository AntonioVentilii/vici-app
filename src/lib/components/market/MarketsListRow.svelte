<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { MARKET_TAG_LABEL_KEYS, type MarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { formatToken } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';

	/**
	 * Verbatim port of prototype `MarketRow` (screens.jsx:182-193).
	 *
	 *   <div onClick={onClick} className="card" style={{ padding: 14, cursor: 'pointer' }}>
	 *     <div className="row between">
	 *       <span className="tag" style={{ color: catColor(m.cat) }}>{m.cat.toUpperCase()}</span>
	 *       <span className="num mute t-eyebrow">{m.vol} vol · {m.closes}</span>
	 *     </div>
	 *     <div className="t-body" style={{ marginTop: 8, fontWeight: 600, lineHeight: 1.35 }}>{m.q}</div>
	 *     <div className="row between" style={{ marginTop: 12, gap: 12 }}>
	 *       <div style={{ flex: 1 }}><ProbBar yes={m.yes} /></div>
	 *       <span className="num t-body fw-600" style={{ color: m.yes >= 50 ? 'var(--yes)' : 'var(--no)' }}>{m.yes}%</span>
	 *     </div>
	 *   </div>
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
			day: 'numeric',
			year: 'numeric'
		})
	);

	const onClick = () => goto(resolve(`${AppPath.Markets}/${market.id}`));
</script>

<div
	style="padding: 14px; cursor: pointer;"
	class="card"
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
		<span class="num mute t-eyebrow"
			>{vol} {t({ locale: $localeStore, key: 'market.vol_suffix' })} · {closes}</span
		>
	</div>
	<div style="margin-top: 8px; font-weight: 600; line-height: 1.35;" class="t-body">
		{market.title}
	</div>
	<div style="margin-top: 12px; gap: 12px;" class="row between">
		<div style="flex: 1;">
			<div class="probbar">
				<i
					style:width="{yes}%"
					style:background={yes >= 50
						? undefined
						: 'linear-gradient(90deg, var(--no-deep), var(--no))'}
				></i>
			</div>
		</div>
		<span style:color={yes >= 50 ? 'var(--yes)' : 'var(--no)'} class="num t-body fw-600"
			>{yes}%</span
		>
	</div>
</div>
