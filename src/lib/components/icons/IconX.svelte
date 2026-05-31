<script lang="ts">
	// X (formerly Twitter) glyph. Lucide dropped its brand icons, so
	// this bespoke filled mark keeps the share tiles consistent.
	interface Props {
		size?: number;
	}

	const { size = 16 }: Props = $props();
</script>

<svg
	aria-hidden="true"
	fill="currentColor"
	height={size}
	viewBox="0 0 24 24"
	width={size}
	xmlns="http://www.w3.org/2000/svg"
>
	<path
		d="M18.244 2H21l-6.52 7.45L22.5 22h-6.97l-5.46-7.13L3.6 22H.84l7-7.99L0 2h7.13l4.93 6.52L18.244 2z"
	/>
</svg>
