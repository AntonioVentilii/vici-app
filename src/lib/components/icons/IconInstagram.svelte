<script lang="ts">
	// Instagram glyph (rounded-square camera). Lucide dropped its brand
	// icons, so this bespoke mark keeps the share tiles consistent.
	interface Props {
		size?: number;
	}

	const { size = 22 }: Props = $props();
</script>

<svg
	aria-hidden="true"
	fill="none"
	height={size}
	stroke="currentColor"
	stroke-width="2"
	viewBox="0 0 24 24"
	width={size}
	xmlns="http://www.w3.org/2000/svg"
>
	<rect height="18" rx="5" width="18" x="3" y="3" />
	<circle cx="12" cy="12" r="4" />
	<circle cx="17.5" cy="6.5" fill="currentColor" r="1" stroke="none" />
</svg>
