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
	<path d="M5 16 L12 9 L19 16" />
	<path d="M5 11 L12 4 L19 11" opacity="0.45" />
</svg>
