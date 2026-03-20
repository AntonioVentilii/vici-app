<script lang="ts">
	import { fade } from 'svelte/transition';

	interface DataPoint {
		time: number;
		value: number; // 0 to 1
	}

	interface Props {
		data?: DataPoint[];
		width?: number;
		height?: number;
		color?: string;
	}

	const {
		data = [],
		width = 600,
		height = 200,
		color = '#6366f1' // indigo-500
	}: Props = $props();

	const hasEnoughData = $derived(data.length >= 2);

	const points = $derived(
		data
			.map((d: DataPoint, i: number) => {
				const x = (i / (data.length - 1)) * width;
				const y = height - d.value * height;
				return `${x},${y}`;
			})
			.join(' ')
	);

	const areaPoints = $derived(`${points} ${width},${height} 0,${height}`);
</script>

<div class="relative w-full overflow-hidden rounded-2xl bg-slate-50/50 p-4 ring-1 ring-slate-100">
	<div class="mb-4 flex items-center justify-between">
		<h4 class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
			Probability Trend
		</h4>
		<span class="text-[10px] font-bold text-indigo-600 uppercase">Live (24h)</span>
	</div>

	{#if hasEnoughData}
		<svg
			class="h-full w-full"
			preserveAspectRatio="none"
			viewBox="0 0 {width} {height}"
			in:fade={{ duration: 1000 }}
		>
			<!-- Gradient Area -->
			<defs>
				<linearGradient id="area-gradient" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stop-color={color} stop-opacity="0.2" />
					<stop offset="100%" stop-color={color} stop-opacity="0" />
				</linearGradient>
			</defs>

			<polyline fill="url(#area-gradient)" points={areaPoints} />

			<!-- Trend Line -->
			<polyline
				class="drop-shadow-sm"
				fill="none"
				{points}
				stroke={color}
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="3"
			/>
		</svg>
		<div
			class="mt-4 flex justify-between border-t border-slate-100 pt-2 text-[8px] font-bold text-slate-300 uppercase"
		>
			<span>24h ago</span>
			<span>Now</span>
		</div>
	{:else}
		<div class="flex h-37.5 items-center justify-center text-center">
			<div class="space-y-1">
				<p class="text-xs font-black tracking-widest text-slate-300 uppercase">Insufficient Data</p>
				<p class="text-[10px] text-slate-400">Trend visualization requires more market activity.</p>
			</div>
		</div>
	{/if}
</div>
