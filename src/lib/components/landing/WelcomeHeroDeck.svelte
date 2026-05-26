<script lang="ts">
	import WelcomeHeroFlowCard from '$lib/components/landing/WelcomeHeroFlowCard.svelte';
	import { WELCOME_MARKET_PREVIEWS } from '$lib/constants/welcome-markets.constants';

	/**
	 * 3-card stacked deck for the hero visual — ports the prototype's
	 * `HeroVisual` (landing.jsx:660-680). Renders the first three demo
	 * markets behind one another with progressive translate / rotate +
	 * opacity falloff so the hero reads as "a deck of upcoming calls"
	 * rather than a single isolated card.
	 *
	 * Indexing mirrors the prototype: `.slice().reverse()` so the
	 * front-most card (depth 0) is the FIRST market — the same card
	 * that used to render as the lone hero flow card.
	 */
	const cards = WELCOME_MARKET_PREVIEWS.slice(0, 3);
	const stacked = [...cards].reverse(); // back → front
</script>

<div class="welcome-hero-deck">
	{#each stacked as market, i (market.id)}
		{@const depth = stacked.length - 1 - i}
		<div
			style="
				transform: translate({depth * -16}px, {depth * -12}px) rotate({depth * -2.2}deg);
				z-index: {10 + i};
				opacity: {1 - depth * 0.22};
			"
			class="welcome-hero-deck-card"
			class:welcome-hero-deck-card--top={depth === 0}
		>
			<WelcomeHeroFlowCard {market} />
		</div>
	{/each}
</div>

<style lang="postcss">
	/* Fixed height container — mirrors the prototype's `.lp-hero-visual`
	   (landing.css:169: `height:600px`). A `min-height` collapsed to the
	   relatively-positioned top card and let the back cards bleed
	   through the rounded corners; a fixed height locks the deck box so
	   the absolute cards share a single, predictable frame. */
	.welcome-hero-deck {
		position: relative;
		width: 100%;
		max-width: 26rem;
		height: 36rem;
		margin-left: auto;
		margin-right: auto;
	}

	/* All cards share the same box. The front card (`--top`) sits on
	   top via its higher z-index (set inline). Front gets pointer-events;
	   back cards are decorative-only. */
	.welcome-hero-deck-card {
		position: absolute;
		inset: 0;
		transition: transform 320ms var(--ease-vici);
		pointer-events: none;
		mix-blend-mode: normal;
	}

	.welcome-hero-deck-card--top {
		pointer-events: auto;
	}

	/* Lock the inner card to be fully opaque so the back cards never
	   visually leak through the front. The hero card already paints a
	   solid `var(--bg-popover) → var(--bg-surface)` gradient; we just
	   make sure no parent stacking-context opacity interferes. */
	.welcome-hero-deck-card :global(.welcome-flow-card) {
		height: 100%;
		background: linear-gradient(180deg, var(--bg-popover), var(--bg-surface));
		box-shadow:
			var(--inset-hi),
			var(--shadow-card),
			0 30px 80px -30px color-mix(in srgb, var(--ink) 70%, transparent);
	}
</style>
