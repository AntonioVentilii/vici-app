<script lang="ts">
	/**
	 * Verbatim port of the prototype's `Ticker` (`landing.jsx:682-699`).
	 * Renders the first 8 LANDING_MARKETS doubled-up (so the seamless
	 * scroll loops without a visible cut) inside the `.lp-ticker`
	 * frame defined in `src/landing.css`.
	 */
	import { LANDING_CAT_COLORS, LANDING_MARKETS } from '$lib/constants/landing-data.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	const items = LANDING_MARKETS.slice(0, 8);
	const track = $derived([...items, ...items]);
</script>

<div class="lp-ticker" aria-hidden="true">
	<div class="lp-ticker-track">
		{#each track as m, i (i)}
			<div class="lp-ticker-item">
				<span style="color:{LANDING_CAT_COLORS[m.cat]};" class="tag">
					{m.cat.toUpperCase()}
				</span>
				<span style="color:var(--fg-dim);">{m.q}</span>
				<span
					style="font-weight:600; color:{m.yes >= 50 ? 'var(--yes)' : 'var(--no)'};"
					class="num"
				>
					{m.yes}%
				</span>
				<span class="num mute t-eyebrow">
					{t({ locale: $localeStore, key: 'ticker.consensus' })}
				</span>
			</div>
		{/each}
	</div>
</div>
