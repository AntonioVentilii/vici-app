<script lang="ts">
	// Facebook glyph. Lucide dropped its brand icons, so this bespoke
	// filled mark keeps the share tiles consistent.
	interface Props {
		size?: number;
	}

	const { size = 20 }: Props = $props();
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
		d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.4 1.5-3.8 3.7-3.8 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.5V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"
	/>
</svg>
