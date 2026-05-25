<script lang="ts">
	interface Props {
		size?: number;
		animate?: boolean;
		withChart?: boolean;
	}

	let { size = 48, animate = true, withChart = false }: Props = $props();

	const FILL = '#5DB6A9';
</script>

<svg aria-hidden="true" height={size} viewBox="0 0 80 80" width={size}>
	<ellipse cx="40" cy="74" fill="#000" opacity="0.3" rx="22" ry="3" />

	<ellipse cx="40" cy="50" fill={FILL} rx="22" ry="20" />

	<circle cx="32" cy="46" fill="#F2ECDC" r="7" />
	<circle cx="48" cy="46" fill="#F2ECDC" r="7" />
	<circle cx="32" cy="46" fill="#0E0D0B" r="3.5" />
	<circle cx="48" cy="46" fill="#0E0D0B" r="3.5" />

	<path
		d="M25 46 L39 46 M41 46 L55 46"
		fill="none"
		stroke="#0E0D0B"
		stroke-linecap="round"
		stroke-width="1.4"
	/>
	<path
		d="M37 56 q3 2 6 0"
		fill="none"
		stroke="#0E0D0B"
		stroke-linecap="round"
		stroke-width="1.4"
	/>

	{#if withChart}
		<rect x="50" y="56" width="22" height="14" rx="2" fill="#F2ECDC" opacity="0.92" />
		<path
			class={animate ? 'char-chart' : ''}
			d="M53 66 L57 60 L61 64 L67 56"
			fill="none"
			stroke={FILL}
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.6"
		/>
	{/if}
</svg>

<style lang="postcss">
	.char-chart {
		stroke-dasharray: 28;
		stroke-dashoffset: 28;
		animation: char-chart 2.4s ease-in-out infinite;
	}

	@keyframes char-chart {
		0% {
			stroke-dashoffset: 28;
		}
		40%,
		60% {
			stroke-dashoffset: 0;
		}
		100% {
			stroke-dashoffset: 28;
		}
	}
</style>
