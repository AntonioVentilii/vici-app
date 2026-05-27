<script lang="ts">
	/**
	 * Verbatim port of the prototype's `TrustAndClose`
	 * (`landing.jsx:1323-1353`). Combined closer section: credibility
	 * wall (3 pillars) → hairline divider → final CTA with Latin
	 * sign-off.
	 */
	import { ChevronRight } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { PublicPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	const pillars: ReadonlyArray<{ t: MessageKey; body: MessageKey }> = [
		{ t: 'trust.p1_t', body: 'trust.p1_b' },
		{ t: 'trust.p2_t', body: 'trust.p2_b' },
		{ t: 'trust.p3_t', body: 'trust.p3_b' }
	];
</script>

<section id="trust" style="background:rgba(242,236,220,0.02);" class="lp-section lp-close lp-root">
	<div class="lp-section-inner">
		<div style="gap:14px; max-width:680px;" class="col">
			<span class="eyebrow acc">{t({ locale: $localeStore, key: 'trust.eyebrow' })}</span>
			<h2 class="lp-h2">
				{t({ locale: $localeStore, key: 'trust.title_a' })}
				<span class="serif-italic acc">
					{t({ locale: $localeStore, key: 'trust.title_b' })}
				</span>
			</h2>
			<p style="color:var(--fg-dim);" class="lp-lede">
				{t({ locale: $localeStore, key: 'trust.sub' })}
			</p>
		</div>

		<div style="margin-top:48px;" class="lp-grid-3">
			{#each pillars as p, i (i)}
				<div class="lp-trust-pillar">
					<h4 class="lp-trust-h">{t({ locale: $localeStore, key: p.t })}</h4>
					<p style="margin-top:8px; line-height:1.6;" class="dim t-body">
						{t({ locale: $localeStore, key: p.body })}
					</p>
				</div>
			{/each}
		</div>

		<div
			style="
				height:1px; background:var(--border);
				margin:64px auto 56px; max-width:320px; opacity:0.5;
			"
			aria-hidden="true"
		></div>

		<div style="text-align:center; max-width:620px; margin:0 auto;">
			<div style="font-size:26px; margin-bottom:18px;" class="serif-italic acc">
				Veni. Vidi. Vici.
			</div>
			<h2 class="lp-h2">{t({ locale: $localeStore, key: 'final.title' })}</h2>
			<p style="margin-top:14px; margin-inline:auto;" class="lp-lede">
				{t({ locale: $localeStore, key: 'final.lede' })}
			</p>
			<div style="gap:10px; margin-top:32px; justify-content:center; flex-wrap:wrap;" class="row">
				<button
					class="btn btn-primary btn-lg"
					onclick={() => goto(PublicPath.SignUp)}
					type="button"
				>
					{t({ locale: $localeStore, key: 'cta.start_predict' })}
					<ChevronRight size={16} />
				</button>
			</div>
		</div>
	</div>
</section>
