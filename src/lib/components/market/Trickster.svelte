<script lang="ts">
	import TricksterChar from '$lib/components/characters/TricksterChar.svelte';

	/**
	 * Trickster — contrarian-call pill character. Thin wrapper around the
	 * shared `TricksterChar` SVG so Flow-surface callers (FlowCard front
	 * header, WelcomeHeroFlowCard) can drop in `<Trickster />` exactly the
	 * way the prototype's `flow.jsx` does (`window.Trickster` size + the
	 * `lightning` bolt accents). The SVG mass lives in the shared
	 * character component so we don't fork the path data across surfaces.
	 *
	 * Prototype source: `VICI WebApp Beta V1.2/characters.jsx:55-78` —
	 * `const Trickster = ({ size = 48, animate = true, lightning = false })`.
	 */
	interface Props {
		size?: number;
		animate?: boolean;
		lightning?: boolean;
	}

	const { size = 48, animate = true, lightning = false }: Props = $props();
</script>

<TricksterChar {animate} {lightning} {size} />
