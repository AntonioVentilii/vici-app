<script lang="ts">
	import type { ClearingDid } from '$declarations';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import type { Position } from '$lib/types/position';
	import { t } from '$lib/utils/i18n.utils';
	import { calculatePositionPnL } from '$lib/utils/portfolio.utils';

	/**
	 * Portfolio · Performance · 30D
	 *
	 * Builds a 30-day cumulative realised-PnL sparkline from `tradeHistory`
	 * settled events on VXP markets, plus a header percentage delta
	 * relative to the current VXP balance.
	 *
	 * Caller is responsible for passing only events that belong to the
	 * signed-in user — `tradeHistory` derived store already scopes them.
	 *
	 * Renders nothing when there are no settled events in the window,
	 * which keeps the Portfolio page tidy for new users.
	 */
	interface Props {
		tradeHistory: ClearingDid.Event[];
		positions: Position[];
		markets: Market[];
		vxpBalance: number;
	}

	const DAY_MS = 24 * 60 * 60 * 1000;
	const WINDOW_DAYS = 30;
	const NS_PER_MS = 1_000_000n;
	const W = 320;
	const H = 72;

	const { tradeHistory, positions, markets, vxpBalance }: Props = $props();

	const getMarketById = (id: string) => markets.find((m) => m.id === id);

	/**
	 * Per-day realised PnL across the 30-day window. Index 0 = today − 29,
	 * index 29 = today.
	 *
	 * We iterate over Resolved positions (not over Settled events) and
	 * attribute each position's `calculatePositionPnL` once, at the day of
	 * its latest Settled event. This dedupes partial-settlement events that
	 * the clearing engine may emit for the same series and avoids the
	 * double-counting that "one PnL contribution per event" would produce.
	 *
	 * Trade-off: a position pruned from the store after settling will not
	 * contribute. The clearing event payload doesn't carry cost basis, so
	 * we can't recover historical PnL from events alone without it.
	 */
	const dailyPnl = $derived.by((): number[] => {
		const buckets = new Array<number>(WINDOW_DAYS).fill(0);
		const cutoffMs = Date.now() - WINDOW_DAYS * DAY_MS;
		const todayStartMs = Math.floor(Date.now() / DAY_MS) * DAY_MS;

		// Pre-index latest Settled event timestamp (ms) per series_id.
		const latestSettledMsBySeries: Record<string, number> = {};

		for (const event of tradeHistory) {
			if ('Settled' in event.event_type) {
				const tsMs = Number(event.timestamp / NS_PER_MS);
				const current = latestSettledMsBySeries[event.series_id];

				if (current === undefined || tsMs > current) {
					latestSettledMsBySeries[event.series_id] = tsMs;
				}
			}
		}

		for (const position of positions) {
			const market = getMarketById(position.marketId);

			if (
				market !== undefined &&
				market.status === 'Resolved' &&
				market.token.symbol === VXP_TOKEN.symbol
			) {
				const tsMs = latestSettledMsBySeries[position.marketId];

				if (tsMs !== undefined && tsMs >= cutoffMs) {
					const dayIndex =
						WINDOW_DAYS -
						1 -
						Math.floor((todayStartMs - Math.floor(tsMs / DAY_MS) * DAY_MS) / DAY_MS);

					if (dayIndex >= 0 && dayIndex < WINDOW_DAYS) {
						buckets[dayIndex] += calculatePositionPnL({ position, market });
					}
				}
			}
		}

		return buckets;
	});

	const cumulative = $derived.by((): number[] => {
		let running = 0;

		return dailyPnl.map((d) => (running += d));
	});

	const totalPnl = $derived(cumulative.length > 0 ? cumulative[cumulative.length - 1] : 0);

	const hasData = $derived(dailyPnl.some((d) => d !== 0));

	const deltaPct = $derived.by((): number => {
		if (vxpBalance <= 0 || !hasData) {
			return 0;
		}

		return (totalPnl / vxpBalance) * 100;
	});

	const deltaSign = $derived(totalPnl >= 0 ? '+' : '−');

	const deltaDisplay = $derived(`${deltaSign}${Math.abs(deltaPct).toFixed(1)}%`);

	const linePath = $derived.by((): string => {
		if (!hasData) {
			return '';
		}

		const min = Math.min(0, ...cumulative);
		const max = Math.max(0, ...cumulative);
		const span = max - min || 1;

		return cumulative
			.map((value, index) => {
				const x = (index / (cumulative.length - 1)) * W;
				const y = H - ((value - min) / span) * H;

				return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	});

	const areaPath = $derived(linePath === '' ? '' : `${linePath} L${W},${H} L0,${H} Z`);

	const isPositive = $derived(totalPnl >= 0);
</script>

{#if hasData}
	<section class="perf-card">
		<header class="perf-head">
			<p class="eyebrow perf-eyebrow">
				{t({ locale: $localeStore, key: 'portfolio.performance.eyebrow' })}
			</p>
			<span class="num perf-delta" class:is-negative={!isPositive} class:is-positive={isPositive}>
				{deltaDisplay}
			</span>
		</header>

		<svg class="perf-spark" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 {W} {H}">
			<defs>
				<linearGradient id="portfolioPerfGrad" x1="0" x2="0" y1="0" y2="1">
					<stop
						offset="0%"
						stop-color={isPositive ? 'var(--yes, #6fe0b6)' : 'var(--no, #ff6b6b)'}
						stop-opacity="0.32"
					/>
					<stop
						offset="100%"
						stop-color={isPositive ? 'var(--yes, #6fe0b6)' : 'var(--no, #ff6b6b)'}
						stop-opacity="0"
					/>
				</linearGradient>
			</defs>
			<path d={areaPath} fill="url(#portfolioPerfGrad)" />
			<path
				d={linePath}
				fill="none"
				stroke={isPositive ? 'var(--yes, #6fe0b6)' : 'var(--no, #ff6b6b)'}
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="1.5"
			/>
		</svg>
	</section>
{/if}

<style lang="postcss">
	.perf-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		background: var(--bg-popover);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.perf-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.perf-eyebrow {
		margin: 0;
		color: var(--text-muted);
	}

	.perf-delta {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-muted);
	}

	.perf-delta.is-positive {
		color: var(--yes);
	}

	.perf-delta.is-negative {
		color: var(--no);
	}

	.perf-spark {
		display: block;
		width: 100%;
		height: 72px;
		margin-top: 0.25rem;
	}
</style>
