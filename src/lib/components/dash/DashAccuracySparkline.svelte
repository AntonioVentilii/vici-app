<script lang="ts">
	/**
	 * Compact accuracy-trend sparkline for the Dash.
	 *
	 * Mirrors the prototype's static SVG in `screens.jsx` DashScreen:
	 *  - filled area at 32 % laurel-tint at the top, fading to 0
	 *  - line stroke `--accent`
	 *  - trailing dot at the right edge
	 *  - no tap-to-reveal markers (unlike `FlowCardSparkline`)
	 *
	 * Accepts an array of accuracy points (0..100) — typically 14
	 * samples generated server-side from the user's settled history
	 * over the active time window. Falls back to a stable demo
	 * sequence so the surface still reads as "data exists" before the
	 * trend aggregator is wired through.
	 */
	interface Props {
		points?: readonly number[];
	}

	const fallbackPoints = [42, 48, 46, 52, 50, 58, 54, 60, 62, 68, 66, 72, 70, 76] as const;

	const { points = fallbackPoints }: Props = $props();

	const w = 280;
	const h = 60;

	const safe = $derived(points.length > 1 ? points : fallbackPoints);

	const coords = $derived(
		safe.map((value, index) => {
			const x = (index / (safe.length - 1)) * w;
			const y = h - (Math.max(0, Math.min(100, value)) / 100) * h - 2;

			return { x, y };
		})
	);

	const linePath = $derived(
		coords
			.map((coord, index) => {
				const command = index === 0 ? 'M' : 'L';
				const xText = coord.x.toFixed(1);
				const yText = coord.y.toFixed(1);

				return `${command}${xText},${yText}`;
			})
			.join(' ')
	);

	const areaPath = $derived(`${linePath} L${w},${h} L0,${h} Z`);

	const lastPoint = $derived(coords[coords.length - 1]);
</script>

<svg
	class="dash-spark"
	aria-hidden="true"
	preserveAspectRatio="none"
	role="img"
	viewBox="0 0 {w} {h}"
>
	<defs>
		<linearGradient id="dashSparkGrad" x1="0" x2="0" y1="0" y2="1">
			<stop offset="0%" stop-color="rgba(226,184,66,0.32)" />
			<stop offset="100%" stop-color="rgba(226,184,66,0)" />
		</linearGradient>
	</defs>
	<path d={areaPath} fill="url(#dashSparkGrad)" />
	<path
		d={linePath}
		fill="none"
		stroke="var(--accent, var(--laurel))"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width="1.6"
	/>
	<circle cx={lastPoint.x} cy={lastPoint.y} fill="var(--accent, var(--laurel))" r="3" />
</svg>

<style lang="postcss">
	.dash-spark {
		display: block;
		width: 100%;
		height: 60px;
	}
</style>
