import type { ClearingDid } from '$declarations';
import { DAY_IN_NANOSECONDS, MILLISECOND_IN_NANOSECONDS } from '$lib/constants/app.constants';
import { decimalFixedValueToNumber } from '$lib/utils/format.utils';

/**
 * The chart period chips on the market-detail surface. Each maps to an
 * engine query window — see {@link priceHistoryQueryWindow}.
 */
export type PriceHistoryPeriod = '1d' | '7d' | '30d' | 'all';

interface PriceHistoryWindow {
	interval: ClearingDid.PriceHistoryInterval;
	/** Inclusive lower query bound (ns). Omitted for `all` (no lower bound). */
	startTimeNs?: bigint;
	/** Upper edge of the chart's x-axis (ns) — "now". */
	endTimeNs: bigint;
}

export interface MarketPriceSeries {
	/** YES percentages (0–100), oldest first. */
	yes: number[];
	/**
	 * Parallel x-fractions (0–1) placing each point on the time axis across
	 * the chart window, so the line spacing reflects real elapsed time (gaps
	 * where no trades landed) rather than uniform per-bucket steps. Same length
	 * as {@link yes}.
	 */
	xs: number[];
}

const HOUR_INTERVAL: ClearingDid.PriceHistoryInterval = { Hour: null };
const DAY_INTERVAL: ClearingDid.PriceHistoryInterval = { Day: null };

// How many days back each bounded period spans.
const PERIOD_DAYS: Record<Exclude<PriceHistoryPeriod, 'all'>, bigint> = {
	'1d': 1n,
	'7d': 7n,
	'30d': 30n
};

/**
 * Maps a chart period chip to the clearing query window: the bucket
 * resolution and the lower time bound (ns). Short windows use hourly
 * candles so a `1d` / `7d` line has shape; longer windows use daily
 * candles to keep the candle count bounded. `all` requests every candle
 * with no lower bound.
 */
export const priceHistoryQueryWindow = (period: PriceHistoryPeriod): PriceHistoryWindow => {
	const endTimeNs = BigInt(Date.now()) * MILLISECOND_IN_NANOSECONDS;

	if (period === 'all') {
		return { interval: DAY_INTERVAL, endTimeNs };
	}

	const interval = period === '30d' ? DAY_INTERVAL : HOUR_INTERVAL;
	const startTimeNs = endTimeNs - PERIOD_DAYS[period] * DAY_IN_NANOSECONDS;

	return { interval, startTimeNs, endTimeNs };
};

/**
 * Real, market-wide price history for one series, derived from the
 * clearing canister's OHLC candles ({@link ClearingDid.SeriesPriceCandle}).
 *
 * Each candle's `close` is the consensus the last trade in that bucket
 * executed at, which is what the sparkline plots; we map it to a 0–100 YES
 * percentage and place it on the time axis via its `bucket_start_ns` (an
 * x-fraction across `[windowStartNs, windowEndNs]`), so the line reflects
 * real elapsed time — including gaps where no trades landed — rather than
 * uniform per-bucket steps. Candles arrive ascending by `bucket_start_ns`,
 * so the series stays in chronological order. The resulting line reflects
 * the TRUE market movement for all viewers, not the viewer's own fills. A
 * window with no executed trades yields empty arrays, which the sparkline
 * reads as a true cold-start flat line.
 */
export const deriveMarketPriceSeries = ({
	candles,
	windowStartNs,
	windowEndNs
}: {
	candles: ClearingDid.SeriesPriceCandle[];
	windowStartNs: bigint;
	windowEndNs: bigint;
}): MarketPriceSeries => {
	const startMs = Number(windowStartNs / MILLISECOND_IN_NANOSECONDS);
	const endMs = Number(windowEndNs / MILLISECOND_IN_NANOSECONDS);
	// Guard against a zero/negative span (degenerate window) so the fraction
	// stays finite; the values are clamped to [0, 1] regardless.
	const spanMs = Math.max(endMs - startMs, 1);

	const yes: number[] = [];
	const xs: number[] = [];

	candles.forEach((candle) => {
		const yesProbability = decimalFixedValueToNumber({
			value: candle.close.decimal.value,
			decimals: candle.close.decimal.decimals
		});

		// Plot only real history: a malformed / non-finite price is dropped
		// rather than backfilled with a synthetic midpoint, so the series
		// stays strictly the prices that actually executed.
		if (!Number.isFinite(yesProbability)) {
			return;
		}

		yes.push(Math.max(0, Math.min(100, Math.round(yesProbability * 100))));

		const bucketMs = Number(candle.bucket_start_ns / MILLISECOND_IN_NANOSECONDS);
		xs.push(Math.max(0, Math.min(1, (bucketMs - startMs) / spanMs)));
	});

	return { yes, xs };
};
