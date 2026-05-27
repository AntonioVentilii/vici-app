<script lang="ts">
	/**
	 * Verbatim port of the prototype's `Trickster` character SVG
	 * (`characters.jsx:56-78`). Fox silhouette with optional lightning
	 * bolts. Used on the LandingFlowCard's contrarian (minority<25%)
	 * markets.
	 */
	interface Props {
		size?: number;
		lightning?: boolean;
	}

	const { size = 48, lightning = false }: Props = $props();
	const fill = '#FF8A7A';
</script>

<svg aria-hidden="true" height={size} viewBox="0 0 80 80" width={size}>
	<ellipse cx="40" cy="74" fill="#000" opacity="0.3" rx="22" ry="3" />
	<path
		style="transform-origin: 55px 55px;"
		d="M55 50 Q72 60 70 70 Q60 64 55 60 Z"
		{fill}
		opacity="0.8"
	/>
	<ellipse cx="42" cy="50" {fill} rx="18" ry="14" />
	<g style="transform-origin: 30px 32px;">
		<path d="M28 32 L24 18 L36 26 Z" {fill} />
		<path d="M30 30 L28 24 L33 28 Z" fill="#F2ECDC" opacity="0.4" />
	</g>
	<path d="M52 32 L60 22 L56 34 Z" {fill} />
	<path d="M55 30 L57 24 L52 28 Z" fill="#F2ECDC" opacity="0.4" />
	<path
		d="M34 46 q2 -2 3 0"
		fill="none"
		stroke="#0E0D0B"
		stroke-linecap="round"
		stroke-width="1.4"
	/>
	<path
		d="M48 46 q2 -2 3 0"
		fill="none"
		stroke="#0E0D0B"
		stroke-linecap="round"
		stroke-width="1.4"
	/>
	<path
		d="M40 52 q2 1.5 4 0"
		fill="none"
		stroke="#0E0D0B"
		stroke-linecap="round"
		stroke-width="1.4"
	/>
	<path d="M40 50 L40 56" stroke="#0E0D0B" stroke-linecap="round" stroke-width="1.4" />
	{#if lightning}
		<path d="M66 36 l-3 -3 l5 -1 l-2 5" fill="#FF6B6B" />
		<path d="M14 38 l3 -3 l-5 -1 l2 5" fill="#FF6B6B" />
	{/if}
</svg>
