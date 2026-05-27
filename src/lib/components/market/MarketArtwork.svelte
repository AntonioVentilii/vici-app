<script lang="ts">
	import FlowArtFrame from '$lib/components/artwork/FlowArtFrame.svelte';
	import type { FlowArtCategory, FlowArtState } from '$lib/utils/flow-art.utils';

	/**
	 * Thin wrapper around {@link FlowArtFrame} that adds the
	 * `art-{category}` class on the host so the per-category
	 * "breather" keyframes (`macro-breathe`, `crypto-pulse`,
	 * `sports-drift`, `politics-glow`, `tech-ripple`, `culture-morph`)
	 * bind directly. The underlying SVG renderer already emits
	 * `<g class="art art-{cat} art-seed-{id}">` for WC figures; this
	 * wrapper extends the same naming convention to the surface that
	 * hosts the art, so the breath rides on the frame even when the
	 * SVG body doesn't carry a wrapper group.
	 *
	 * Kept slim because FlowArtFrame already covers theme reactivity
	 * and seed-stable rendering; this just hooks the animation envelope.
	 */
	interface Props {
		category: FlowArtCategory;
		seed: string | number;
		state?: FlowArtState;
		size?: number;
		bleed?: boolean;
		class?: string;
	}

	const {
		category,
		seed,
		state = 'neutral',
		size = 420,
		bleed = false,
		class: extraClass = ''
	}: Props = $props();

	const artClass = $derived(`art-${category}`);
	const seedSlug = $derived(
		String(seed)
			.replace(/[^a-z0-9-]/gi, '-')
			.toLowerCase()
	);
	// WC market ids always carry a `wc-` prefix (e.g. `wc-neymar-dive`,
	// `wc-winner-brazil`); the per-seed CSS selectors in `app.css` use
	// that bare suffix (`.art-seed-wc-neymar-dive .wc-figure { ... }`).
	// Strip the duplicate prefix when composing the class so the
	// seed-specific breather binds to the right `.wc-figure` group
	// rather than emitting `art-seed-wc-wc-neymar-dive` which matches
	// nothing.
	const seedClass = $derived.by(() => {
		if (category === 'wc') {
			const stripped = seedSlug.startsWith('wc-') ? seedSlug.slice(3) : seedSlug;

			return `art-seed-wc-${stripped}`;
		}

		return `art-seed-${seedSlug}`;
	});
</script>

<div class="market-artwork {artClass} {seedClass} {extraClass}" class:is-bleed={bleed}>
	<FlowArtFrame class="flow-art" {category} {seed} {size} {state} />
</div>

<style lang="postcss">
	.market-artwork {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		will-change: transform, opacity;
	}

	/* Bleed mode — edge-to-edge artwork frame. Inherit the host's
	   rounding, drop the FlowArtFrame's own shadow so the breather
	   isn't constrained by a visible card. */
	.market-artwork.is-bleed :global(.flow-art) {
		width: 100%;
		height: 100%;
		max-width: none;
		border-radius: 0;
		box-shadow: none;
	}

	.market-artwork.is-bleed :global(.flow-art > svg),
	.market-artwork.is-bleed :global(.flow-art svg) {
		width: 100%;
		height: 100%;
	}

	/* Pause the per-category breather when the viewer prefers reduced
	   motion. Per-keyframe rules in `app.css` cover the WC sub-tree —
	   this guard short-circuits the host-level transform breath. */
	@media (prefers-reduced-motion: reduce) {
		.market-artwork {
			animation: none;
		}
	}
</style>
