<script lang="ts">
	/**
	 * Hero visual on the landing page — three `LANDING_MARKETS`
	 * rendered as a stacked deck. `slice().reverse()` keeps the top
	 * card as the FIRST market (`wc-winner-brazil`, `hot: true`, so
	 * its minority<25% triggers the Trickster pill).
	 */
	import LandingFlowCard from '$lib/components/landing/LandingFlowCard.svelte';
	import { LANDING_MARKETS } from '$lib/constants/landing-data.constants';

	const cards = LANDING_MARKETS.slice(0, 3);
	const stacked = [...cards].reverse(); // back → front
</script>

<div class="lp-deck">
	{#each stacked as m, i (m.id)}
		{@const depth = stacked.length - 1 - i}
		<div
			style="
				transform: translate({depth * -16}px, {depth * -12}px) rotate({depth * -2.2}deg);
				z-index: {10 + i};
				opacity: {1 - depth * 0.16};
				transition: transform var(--d-enter) var(--ease);
			"
			class="flow-card"
		>
			<LandingFlowCard market={m} />
		</div>
	{/each}
</div>
