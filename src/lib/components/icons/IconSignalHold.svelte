<script lang="ts">
	interface Props {
		size?: string;
	}

	const { size = '24px' }: Props = $props();
</script>

<svg
	aria-hidden="true"
	fill="none"
	height={size}
	stroke="currentColor"
	stroke-linecap="round"
	stroke-linejoin="round"
	stroke-width="1.6"
	viewBox="0 0 24 24"
	width={size}
	xmlns="http://www.w3.org/2000/svg"
>
	<path d="M4 12 L20 12" />
	<path d="M9 8 L9 16" opacity="0.45" />
	<path d="M15 8 L15 16" opacity="0.45" />
</svg>
