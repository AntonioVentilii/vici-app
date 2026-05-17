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
	viewBox="0 0 24 24"
	width={size}
	xmlns="http://www.w3.org/2000/svg"
>
	<path
		d="M12 3 C 12 8, 17 9, 17 14 C 17 18.4 14.8 21 12 21 C 9.2 21 7 18.4 7 14 C 7 11 9 9.5 9 7 C 10.4 8 11 9.5 12 8.5 C 12 6 12 4.5 12 3 Z"
		fill="currentColor"
	/>
</svg>
