<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import type { MarketEvent } from '$lib/types/market-metadata';
	import { eventMarkerX, sparklinePoints } from '$lib/utils/flow-card-display.utils';
	import { t } from '$lib/utils/i18n.utils';

	interface Props {
		seed: string;
		yesPercent: number;
		events?: MarketEvent[];
		accentColor?: string;
	}

	const { seed, yesPercent, events = [], accentColor = 'var(--laurel)' }: Props = $props();

	const width = 280;
	const height = 48;
	const padding = 4;
	const points = $derived(sparklinePoints({ yesPercent, seed }));
	const plottedPoints = $derived(
		points.map((y, i) => {
			const x = padding + (i / Math.max(points.length - 1, 1)) * (width - padding * 2);
			const py = padding + ((100 - y) / 100) * (height - padding * 2);

			return `${x},${py}`;
		})
	);
	const polyline = $derived(plottedPoints.join(' '));
	const areaPath = $derived(
		plottedPoints.length > 0
			? `M ${plottedPoints.join(' L ')} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`
			: ''
	);
</script>

<div class="flow-spark-wrap">
	<svg
		class="flow-spark"
		aria-label={t({ locale: $localeStore, key: 'a11y.seven_day_lean' })}
		role="img"
		viewBox="0 0 {width} {height}"
	>
		<path d={areaPath} fill={accentColor} opacity="0.08" />
		<polyline
			fill="none"
			opacity="0.95"
			points={polyline}
			stroke={accentColor}
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.5"
		/>
		{#each events.slice(0, 2) as event, i (event.label + String(event.day))}
			{@const x = eventMarkerX({ day: event.day, eventCount: points.length, width })}
			<line
				stroke="var(--border-base)"
				stroke-dasharray="2 3"
				stroke-width="1"
				x1={x}
				x2={x}
				y1={padding}
				y2={height - padding}
			/>
			<circle
				cx={x}
				cy={padding +
					((100 - points[Math.min(i, points.length - 1)]) / 100) * (height - padding * 2)}
				fill="var(--bg-popover)"
				r="3"
				stroke={accentColor}
				stroke-width="1.2"
			/>
		{/each}
	</svg>
	{#if events.length > 0}
		<div class="flow-spark-events">
			{#each events.slice(0, 2) as event (event.label)}
				<span class="num flow-spark-event">
					<span class="flow-spark-dir" class:is-up={event.dir === 'up'} aria-hidden="true">
						{event.dir === 'up' ? '+' : '−'}
					</span>
					{event.label}
				</span>
			{/each}
		</div>
	{/if}
</div>

<style lang="postcss">
	.flow-spark-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border-radius: var(--r-12);
	}

	.flow-spark {
		width: 100%;
		height: 48px;
		display: block;
	}

	.flow-spark-events {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
	}

	.flow-spark-event {
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.flow-spark-dir {
		margin-right: 0.25rem;
		font-weight: 700;
		color: var(--no);
	}

	.flow-spark-dir.is-up {
		color: var(--yes);
	}
</style>
