<script lang="ts">
	/**
	 * Editorial radial dial showing which way a binary market leans and
	 * how strongly. Direction: up = YES consensus, down = NO consensus.
	 * Magnitude: needle position from centre (50/50) to extreme (0/100).
	 * The label under the dial shows the *leading side's* percentage so
	 * a market with 35% YES reads as "65%" pointing down.
	 *
	 * Drives semantic colour off the leading side (--yes / --no) rather
	 * than the category palette so it
	 * reads as a market-state indicator, not a category accent.
	 */
	interface Props {
		// 0–1 YES-side probability. Clamped defensively to [0, 1].
		yesProbability: number;
		// Rendered px size (square). 42 matches the in-card dial; 56
		// works well on a wider FlowCardBack panel.
		size?: number;
	}

	const { yesProbability, size = 42 }: Props = $props();

	const yesPct = $derived(Math.max(0, Math.min(100, Math.round(yesProbability * 100))));
	const isYes = $derived(yesPct >= 50);
	// Confidence — 0 at 50/50, 1 at the extremes. Drives the needle
	// rotation linearly so a perfectly balanced market reads horizontal.
	const conf = $derived(Math.abs(yesPct - 50) / 50);
	const angle = $derived(isYes ? -conf * 90 : conf * 90);
	const sideClass = $derived(isYes ? 'yes' : 'no');
	const leadingPct = $derived(Math.max(yesPct, 100 - yesPct));
</script>

<div class="flow-compass {sideClass}" aria-label={`${yesPct}% YES consensus`} role="img">
	<svg height={size} viewBox="0 0 42 42" width={size}>
		<!-- Outer ring -->
		<circle cx="21" cy="21" fill="none" r="18" stroke="var(--border-base)" stroke-width="1.2" />
		<!-- YES (top) and NO (bottom) pole tick marks -->
		<line stroke="var(--text-muted)" stroke-width="1" x1="21" x2="21" y1="2" y2="5" />
		<line stroke="var(--text-muted)" stroke-width="1" x1="21" x2="21" y1="37" y2="40" />
		<!-- Needle -->
		<g transform={`rotate(${angle} 21 21)`}>
			<line
				stroke="var(--needle-color)"
				stroke-linecap="round"
				stroke-width="2.4"
				x1="21"
				x2="21"
				y1="21"
				y2="6"
			/>
			<circle cx="21" cy="6" fill="var(--needle-color)" r="3" />
		</g>
		<!-- Centre hub -->
		<circle cx="21" cy="21" fill="var(--needle-color)" r="2.5" />
	</svg>
	<span class="flow-compass-pct num">{leadingPct}%</span>
</div>

<style lang="postcss">
	.flow-compass {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0;
		flex-shrink: 0;
	}

	.flow-compass svg {
		display: block;
	}

	.flow-compass-pct {
		margin-top: 2px;
		font-size: 9.5px;
		letter-spacing: 0.04em;
		font-weight: 700;
		color: var(--text-muted);
		line-height: 1;
	}

	.flow-compass.yes {
		--needle-color: var(--yes);
	}

	.flow-compass.yes .flow-compass-pct {
		color: var(--yes);
	}

	.flow-compass.no {
		--needle-color: var(--no);
	}

	.flow-compass.no .flow-compass-pct {
		color: var(--no);
	}
</style>
