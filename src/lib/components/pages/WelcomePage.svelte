<script lang="ts">
	/**
	 * Landing surface — a conversion-first, entertainment-first page.
	 *
	 * Sections, top to bottom:
	 *   1. WelcomeNav (desktop + mobile)
	 *   2. WelcomeV2Hero — interactive swipe card + payoff celebration
	 *   3. WelcomeV2Proof — how-it-works + live count + calls ticker
	 *   4. WelcomeV2Status — 3-tab accuracy slider (auto-rotating)
	 *   5. WelcomeV2Trust — condensed trust one-liner
	 *   6. WelcomeFAQ — visitor-stage questions
	 *   7. WelcomeV2Close — Latin motto + closing CTA
	 *   8. WelcomeFooter — FIFA mark + disclosure
	 *
	 * The whole tree is wrapped in `.v2 .lp-root` so it picks up both the
	 * landing-v2 layout layer (the warm parchment field + section rhythm)
	 * and the shared landing primitives (`.flow-card`, `.tag`, `.btn`, …)
	 * from `src/landing.css`.
	 */
	import { onMount } from 'svelte';
	import WelcomeFAQ from '$lib/components/landing/WelcomeFAQ.svelte';
	import WelcomeFooter from '$lib/components/landing/WelcomeFooter.svelte';
	import WelcomeV2Close from '$lib/components/landing/WelcomeV2Close.svelte';
	import WelcomeV2Hero from '$lib/components/landing/WelcomeV2Hero.svelte';
	import WelcomeV2Proof from '$lib/components/landing/WelcomeV2Proof.svelte';
	import WelcomeV2Status from '$lib/components/landing/WelcomeV2Status.svelte';
	import WelcomeV2Trust from '$lib/components/landing/WelcomeV2Trust.svelte';
	import WelcomeNav from '$lib/components/layout/WelcomeNav.svelte';

	onMount(() => {
		document.title = 'VICI';
	});
</script>

<div class="v2 lp-root">
	<WelcomeNav />

	<main id="main">
		<WelcomeV2Hero />
		<WelcomeV2Proof />
		<WelcomeV2Status />
		<WelcomeV2Trust />
		<WelcomeFAQ />
		<WelcomeV2Close />
	</main>

	<WelcomeFooter />
</div>
