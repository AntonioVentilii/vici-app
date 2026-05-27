<script lang="ts">
	import LandingSectionHeader from '$lib/components/landing/LandingSectionHeader.svelte';
	import WelcomeBoutShowcase from '$lib/components/landing/WelcomeBoutShowcase.svelte';
	import WelcomeLeagueShowcase from '$lib/components/landing/WelcomeLeagueShowcase.svelte';
	import WelcomeWorldsUniversitiesBout from '$lib/components/landing/WelcomeWorldsUniversitiesBout.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';

	/**
	 * Social Proof — three side-by-side feature panels (L9 → L10 of the
	 * prototype). Demonstrates the three layers of competition:
	 *   01 · Your League        (private cohort)
	 *   02 · Active Bout        (league vs league)
	 *   03 · Worlds Universities (tentpole tournament)
	 *
	 * Mirrors `<SocialProof>` in landing.jsx:845. Each panel is built
	 * from inline mock data — these are landing visuals, not real-data
	 * surfaces. At desktop the three sit in one row via auto-fit grid;
	 * narrower viewports auto-stack at `minmax(280px, 1fr)`.
	 */
</script>

<div class="welcome-section-inner">
	<LandingSectionHeader
		eyebrow={t({ locale: $localeStore, key: 'social.eyebrow' })}
		sub={t({ locale: $localeStore, key: 'social.sub' })}
		title={t({ locale: $localeStore, key: 'social.title_a' })}
		titleAccent={t({ locale: $localeStore, key: 'social.title_b' })}
	/>

	<div class="welcome-social-grid">
		<WelcomeLeagueShowcase />
		<WelcomeBoutShowcase />
		<WelcomeWorldsUniversitiesBout />
	</div>
</div>

<style lang="postcss">
	.welcome-section-inner {
		max-width: 80rem;
		margin: 0 auto;
	}

	.welcome-social-grid {
		display: grid;
		gap: 1rem;
		align-items: stretch;
		margin-top: 3.5rem;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	}
</style>
