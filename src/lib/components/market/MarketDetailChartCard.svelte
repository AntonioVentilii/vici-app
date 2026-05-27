<script lang="ts">
	import FlowCardSparkline from '$lib/components/market/FlowCardSparkline.svelte';
	import { marketMetadata } from '$lib/derived/market-metadata.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface Props {
		marketId: string;
		yesPercent: number;
	}

	const { marketId, yesPercent }: Props = $props();

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

	const events = $derived($marketMetadata[marketId]?.events ?? []);
</script>

<!-- 7-day chart card with period chips — mirrors `screens.jsx:241-251`.
     Reuses `FlowCardSparkline` so the line shape, event markers, and
     pulse beat stay consistent across Flow cards and the Market detail
     surface. -->
<div class="market-chart-card">
	<div class="market-chart-head">
		<span class="market-chart-eyebrow">
			{t({ locale: $localeStore, key: 'market.detail.chart.eyebrow' })}
		</span>
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
		<FlowCardSparkline {events} seed={marketId} {yesPercent} />
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
		font-size: 10px;
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
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font-size: 10px;
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
