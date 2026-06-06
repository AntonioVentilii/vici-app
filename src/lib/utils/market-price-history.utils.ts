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
	/** Inclusive lower bound (ns). Omitted for `all` (no lower bound). */
	startTimeNs?: bigint;
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
	if (period === 'all') {
		return { interval: DAY_INTERVAL };
	}

	const interval = period === '30d' ? DAY_INTERVAL : HOUR_INTERVAL;
	const startTimeNs =
		BigInt(Date.now()) * MILLISECOND_IN_NANOSECONDS - PERIOD_DAYS[period] * DAY_IN_NANOSECONDS;

	return { interval, startTimeNs };
};

/**
 * Real, market-wide price history for one series, derived from the
 * clearing canister's OHLC candles ({@link ClearingDid.SeriesPriceCandle}).
 *
 * Each candle's `close` is the consensus the last trade in that bucket
 * executed at, which is what the sparkline plots; we map it to a 0–100 YES
 * percentage. Candles arrive ascending by `bucket_start_ns`, so the series
 * is already in chronological order. The resulting line reflects the TRUE
 * market movement for all viewers, not the viewer's own fills. A series
 * with no executed trades in the window yields an empty array, which the
 * sparkline reads as a true cold-start flat line.
 *
 * @returns YES percentages (0–100) in bucket order, oldest first. Empty
 *   when the window contains no executed trades.
 */
export const deriveMarketPriceCandles = (candles: ClearingDid.SeriesPriceCandle[]): number[] =>
	candles.reduce<number[]>((series, candle) => {
		const yesProbability = decimalFixedValueToNumber({
			value: candle.close.decimal.value,
			decimals: candle.close.decimal.decimals
		});

		// Plot only real history: a malformed / non-finite price is dropped
		// rather than backfilled with a synthetic midpoint, so the series
		// stays strictly the prices that actually executed.
		if (Number.isFinite(yesProbability)) {
			series.push(Math.max(0, Math.min(100, Math.round(yesProbability * 100))));
		}

		return series;
	}, []);
