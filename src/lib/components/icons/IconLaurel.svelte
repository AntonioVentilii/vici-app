<script lang="ts">
	interface Props {
		size?: number;
	}

	const { size = 40 }: Props = $props();

	const width = $derived(Math.round((size * 200) / 120));
</script>

<svg
	aria-hidden="true"
	fill="none"
	height={size}
	stroke="currentColor"
	stroke-linecap="round"
	stroke-linejoin="round"
	stroke-width="1.4"
	viewBox="0 0 200 120"
	{width}
	xmlns="http://www.w3.org/2000/svg"
>
	<g>
		<path d="M50 100 C 30 80, 22 56, 30 28" />
		<ellipse cx="36" cy="84" rx="10" ry="4" transform="rotate(-50 36 84)" />
		<ellipse cx="30" cy="68" rx="11" ry="4" transform="rotate(-65 30 68)" />
		<ellipse cx="28" cy="50" rx="11" ry="4" transform="rotate(-80 28 50)" />
		<ellipse cx="30" cy="34" rx="10" ry="4" transform="rotate(-95 30 34)" />
		<ellipse cx="46" cy="92" rx="9" ry="3.5" transform="rotate(-30 46 92)" />
	</g>
	<g>
		<path d="M150 100 C 170 80, 178 56, 170 28" />
		<ellipse cx="164" cy="84" rx="10" ry="4" transform="rotate(50 164 84)" />
		<ellipse cx="170" cy="68" rx="11" ry="4" transform="rotate(65 170 68)" />
		<ellipse cx="172" cy="50" rx="11" ry="4" transform="rotate(80 172 50)" />
		<ellipse cx="170" cy="34" rx="10" ry="4" transform="rotate(95 170 34)" />
		<ellipse cx="154" cy="92" rx="9" ry="3.5" transform="rotate(30 154 92)" />
	</g>
</svg>
