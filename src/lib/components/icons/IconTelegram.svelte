<script lang="ts">
	// Telegram glyph (paper plane). Lucide dropped its brand icons, so
	// this bespoke filled mark keeps the share tiles consistent.
	interface Props {
		size?: number;
	}

	const { size = 18 }: Props = $props();
</script>

<svg
	aria-hidden="true"
	fill="currentColor"
	height={size}
	viewBox="0 0 24 24"
	width={size}
	xmlns="http://www.w3.org/2000/svg"
>
	<path d="M22 4 2 11.5l5.5 2 1.5 6 3-3 5 4 5-16.5zM9.5 14 18 7l-7 7.5z" />
</svg>
