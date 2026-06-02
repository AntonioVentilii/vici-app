<script lang="ts">
	import FlowCardSparkline from '$lib/components/market/FlowCardSparkline.svelte';
	import { marketMetadata } from '$lib/derived/market-metadata.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface Props {
		marketId: string;
		yesPercent: number;
		/**
		 * Real price-history series (0–100 YES percentages, oldest first)
		 * loaded from the clearing canister's trade history. Empty until
		 * the first trade lands (true cold-start). Optional so call sites
		 * that haven't fetched history fall back to the seed-based shape.
		 */
		points?: number[];
	}

	const { marketId, yesPercent, points }: Props = $props();

	// True cold-start: no real trade history for this market yet, so the
	// line reads flat and the eyebrow note says so rather than implying
	// movement that never happened.
	const isColdStart = $derived(points !== undefined && points.length === 0);

	type PeriodId = '1d' | '7d' | '30d' | 'all';

	// The sparkline currently only resolves a single window (the
	// satellite-side aggregator hasn't been promoted yet) — the chips
	// surface as a visual switch today, and the period picker becomes
	// the wiring point when the aggregator lands.
	const periods: { id: PeriodId; label: MessageKey }[] = [
		{ id: '1d', label: 'market.detail.chart.period.1d' },
		{ id: '7d', label: 'market.detail.chart.period.7d' },
		{ id: '30d', label: 'market.detail.chart.period.30d' },
		{ id: 'all', label: 'market.detail.chart.period.all' }
	];

	let activePeriod = $state<PeriodId>('7d');

	// Event markers are positioned against the seed-based fallback's
	// fixed, day-indexed shape. Real-history mode (`points` supplied) has
	// its own irregular trade-ordered series, so the markers would land on
	// the wrong x-positions — only feed them through for the seed fallback.
	const events = $derived(points === undefined ? ($marketMetadata[marketId]?.events ?? []) : []);
</script>

<!-- Price-history chart card with multi-period chips.
     Reuses `FlowCardSparkline` so the line shape, event markers, and
     pulse beat stay consistent across Flow cards and the Market detail
     surface. -->
<div class="market-chart-card">
	<div class="market-chart-head">
		<span class="market-chart-eyebrow">
			{t({ locale: $localeStore, key: 'market.detail.chart.eyebrow' })}
		</span>
		{#if isColdStart}
			<span class="market-chart-coldstart num">
				{t({ locale: $localeStore, key: 'market.detail.chart.no_trades' })}
			</span>
		{/if}
		<div class="market-chart-chips" role="tablist">
			{#each periods as period (period.id)}
				<button
					class="market-chart-chip"
					class:is-active={activePeriod === period.id}
					aria-selected={activePeriod === period.id}
					onclick={() => (activePeriod = period.id)}
					role="tab"
					type="button"
				>
					{t({ locale: $localeStore, key: period.label })}
				</button>
			{/each}
		</div>
	</div>

	<div class="market-chart-spark">
		<FlowCardSparkline {events} lineColor="var(--laurel)" {points} seed={marketId} {yesPercent} />
	</div>
</div>

<style lang="postcss">
	.market-chart-card {
		margin: 0.75rem 1.25rem;
		padding: 1rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		box-shadow: var(--inset-hi);
	}

	.market-chart-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.market-chart-eyebrow {
		color: var(--text-muted);
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	/* Cold-start note — sits between the eyebrow and the period chips,
	   muted so it reads as a quiet status rather than a value. */
	.market-chart-coldstart {
		margin-left: auto;
		margin-right: 0.5rem;
		color: var(--text-muted);
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.market-chart-chips {
		display: inline-flex;
		gap: 0.25rem;
	}

	.market-chart-chip {
		padding: 2px 8px;
		border: 0;
		border-radius: var(--r-pill);
		background: transparent;
		color: var(--text-muted);
		font-size: var(--t-10);
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	.market-chart-chip:hover {
		color: var(--text-base);
	}

	.market-chart-chip.is-active {
		background: color-mix(in srgb, var(--laurel) 16%, transparent);
		color: var(--laurel);
	}

	.market-chart-spark {
		margin-top: 0.5rem;
	}
</style>
