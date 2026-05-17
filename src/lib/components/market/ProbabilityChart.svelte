<script lang="ts">
	import { fade } from 'svelte/transition';

	interface DataPoint {
		time: number;
		/** Probability in `[0, 1]`. */
		value: number;
	}

	interface Props {
		data?: DataPoint[];
		width?: number;
		height?: number;
		color?: string;
	}

	const { data = [], width = 600, height = 200, color = 'var(--primary)' }: Props = $props();

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

<div class="bg-foreground/5 ring-border relative w-full overflow-hidden rounded-2xl p-4 ring-1">
	<div class="mb-4 flex items-center justify-between">
		<h4 class="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
			Probability Trend
		</h4>
		<span class="text-primary text-[10px] font-bold uppercase">Live (24h)</span>
	</div>

	{#if hasEnoughData}
		<svg
			class="h-full w-full"
			preserveAspectRatio="none"
			viewBox="0 0 {width} {height}"
			in:fade={{ duration: 1000 }}
		>
			<defs>
				<linearGradient id="area-gradient" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stop-color={color} stop-opacity="0.2" />
					<stop offset="100%" stop-color={color} stop-opacity="0" />
				</linearGradient>
			</defs>

			<polyline fill="url(#area-gradient)" points={areaPoints} />

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
			class="border-border text-muted-foreground mt-4 flex justify-between border-t pt-2 text-[8px] font-bold uppercase"
		>
			<span>24h ago</span>
			<span>Now</span>
		</div>
	{:else}
		<div class="flex h-37.5 items-center justify-center text-center">
			<div class="space-y-1">
				<p class="text-muted-foreground text-xs font-black tracking-widest uppercase">
					Insufficient Data
				</p>
				<p class="text-muted-foreground text-[10px]">
					Trend visualization requires more market activity.
				</p>
			</div>
		</div>
	{/if}
</div>
