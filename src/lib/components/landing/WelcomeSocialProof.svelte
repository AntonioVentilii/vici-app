<script lang="ts">
	/**
	 * Verbatim port of the prototype's `SocialProof`
	 * (`landing.jsx:845-863`). Section eyebrow + h2 + lede + 3-panel
	 * grid (LeagueShowcase + BoutShowcase + WorldsUniversitiesBout).
	 * Auto-fit `minmax(280px, 1fr)` so the panels stack on narrow
	 * viewports — same breakpoint behaviour as the prototype.
	 */
	import WelcomeBoutShowcase from '$lib/components/landing/WelcomeBoutShowcase.svelte';
	import WelcomeLeagueShowcase from '$lib/components/landing/WelcomeLeagueShowcase.svelte';
	import WelcomeWorldsUniversitiesBout from '$lib/components/landing/WelcomeWorldsUniversitiesBout.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
</script>

<section id="leaderboard" style="background:rgba(242,236,220,0.02);" class="lp-section lp-root">
	<div class="lp-section-inner">
		<div style="gap:14px; max-width:680px;" class="col">
			<span class="eyebrow acc">{t({ locale: $localeStore, key: 'social.eyebrow' })}</span>
			<h2 class="lp-h2">
				{t({ locale: $localeStore, key: 'social.title_a' })}
				<span class="serif-italic acc">
					{t({ locale: $localeStore, key: 'social.title_b' })}
				</span>
			</h2>
			<p style="color:var(--fg-dim);" class="lp-lede">
				{t({ locale: $localeStore, key: 'social.sub' })}
			</p>
		</div>

		<div
			style="
				margin-top:56px;
				display:grid;
				grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
				gap:16px;
				align-items:stretch;
			"
		>
			<WelcomeLeagueShowcase />
			<WelcomeBoutShowcase />
			<WelcomeWorldsUniversitiesBout />
		</div>
	</div>
</section>
