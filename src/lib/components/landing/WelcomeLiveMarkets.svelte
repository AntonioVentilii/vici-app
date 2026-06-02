<script lang="ts">
	/**
	 * 6-card grid pulled from `LANDING_MARKETS`; synthetic but
	 * deterministic `callers` + `trending` per card via
	 * `m.id.charCodeAt(0) * 173 % 8500` so the numbers stay stable
	 * across renders.
	 */
	import { ChevronRight } from '@lucide/svelte/icons';
	import { LANDING_CAT_COLORS, LANDING_MARKETS } from '$lib/constants/landing-data.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	const items = LANDING_MARKETS.slice(0, 6);

	const formatCallers = (id: string): string =>
		(1200 + ((id.charCodeAt(0) * 173) % 8500)).toLocaleString();

	const isTrendingUp = ({ yes, index }: { yes: number; index: number }): boolean =>
		(yes + index * 3) % 7 < 3;
</script>

<section id="markets" class="lp-section lp-root">
	<div class="lp-section-inner">
		<div style="gap:14px; max-width:680px;" class="col">
			<span class="eyebrow acc">{t({ locale: $localeStore, key: 'markets.eyebrow' })}</span>
			<h2 class="lp-h2">
				{t({ locale: $localeStore, key: 'markets.title_a' })}
				<span class="serif-italic acc">
					{t({ locale: $localeStore, key: 'markets.title_b' })}
				</span>
			</h2>
			<p style="color:var(--fg-dim);" class="lp-lede">
				{t({ locale: $localeStore, key: 'markets.sub' })}
			</p>
		</div>

		<div style="margin-top:56px;" class="lp-grid-3 lp-market-grid">
			{#each items as m, i (m.id)}
				{@const callers = formatCallers(m.id)}
				{@const trendingUp = isTrendingUp({ yes: m.yes, index: i })}
				<a class="card lp-market-card" href="#{m.id}">
					<div class="row between">
						<span style="color:{LANDING_CAT_COLORS[m.cat]};" class="tag">
							{m.cat.toUpperCase()}
						</span>
						<span style="gap:6px;" class="row mute t-eyebrow">
							<span class="num">
								{callers}
								{t({ locale: $localeStore, key: 'card.calls' })}
							</span>
							{#if trendingUp}
								<span class="lp-trend yes">↑</span>
							{/if}
						</span>
					</div>
					<div class="lp-market-q">{m.q}</div>
					<div class="lp-market-bar">
						<div style="margin-bottom:6px;" class="row between">
							<span
								style="color:{m.yes >= 50 ? 'var(--yes)' : 'var(--no)'};"
								class="eyebrow t-micro"
							>
								{t({ locale: $localeStore, key: 'ticker.consensus' }).toUpperCase()} · {m.yes}%
							</span>
							<span class="num mute t-eyebrow">{100 - m.yes}% NO</span>
						</div>
						<div class="probbar">
							<i style="width:{m.yes}%;"></i>
						</div>
					</div>
					<div class="row between lp-market-foot">
						<span class="num mute t-eyebrow">
							{t({ locale: $localeStore, key: 'market.closes' })}
							{m.closes}
						</span>
						<span class="lp-market-open">
							{t({ locale: $localeStore, key: 'market.open_flow' })}
							<ChevronRight size={12} />
						</span>
					</div>
				</a>
			{/each}
		</div>
	</div>
</section>
