<script lang="ts">
	// Minimal Snapchat ghost glyph. There is no Lucide brand icon for
	// Snapchat, so this bespoke filled mark keeps the share tiles
	// consistent (24px box, currentColor fill). Rendered on the brand
	// yellow tile, so the fill is the dark ghost outline.
	interface Props {
		size?: number;
	}

	const { size = 22 }: Props = $props();
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
		d="M12 3c2.4 0 3.9 1.8 3.9 4.1 0 .9-.1 1.7-.1 1.7s1 .6 1.9.3c.6-.2.9.6.3 1-.6.4-1.6.5-1.6 1.2 0 .9 2.2 2.3 3 2.5.5.1.4.7-.1.9-.9.3-1.6.2-2 .7-.3.5.1 1-.6 1.1-.8.1-1.3-.5-2.3-.1-.9.3-1.4 1.4-2.3 1.4s-1.4-1.1-2.3-1.4c-1-.4-1.5.2-2.3.1-.7-.1-.3-.6-.6-1.1-.4-.5-1.1-.4-2-.7-.5-.2-.6-.8-.1-.9.8-.2 3-1.6 3-2.5 0-.7-1-.8-1.6-1.2-.6-.4-.3-1.2.3-1 .9.3 1.9-.3 1.9-.3s-.1-.8-.1-1.7C8.1 4.8 9.6 3 12 3z"
	/>
</svg>
