import type { ClearingDid } from '$declarations';
import { decimalFixedValueToNumber } from '$lib/utils/format.utils';

/**
 * Real, market-wide price history for one series, derived from every
 * executed trade on the clearing canister.
 *
 * `list_series_trade_history` is market-wide (unlike the caller-scoped
 * `get_trade_history`): it returns one {@link ClearingDid.SeriesTradePoint}
 * per executed trade on the series, each carrying the YES price the trade
 * executed at. We sort the points into execution order and map each price
 * to a 0–100 YES percentage. The resulting sparkline reflects the TRUE
 * market movement for all viewers, not the viewer's own fills. A series
 * with no executed trades yields an empty array, which the sparkline reads
 * as a true cold-start flat line.
 *
 * @returns YES percentages (0–100) in execution order, oldest first. Empty
 *   when there are no executed trades for the series.
 */
export const deriveMarketPriceHistory = (points: ClearingDid.SeriesTradePoint[]): number[] =>
	[...points]
		// `event_id` is strictly increasing in execution order, so it is the
		// authoritative chronological key (timestamps can collide or, for
		// backfilled rows, reflect the original settlement time).
		.sort((a, b) => (a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0))
		.reduce<number[]>((series, point) => {
			const yesProbability = decimalFixedValueToNumber({
				value: point.price.decimal.value,
				decimals: point.price.decimal.decimals
			});

			// Plot only real history: a malformed / non-finite price is
			// dropped rather than backfilled with a synthetic midpoint, so
			// the series stays strictly the prices that actually executed.
			if (Number.isFinite(yesProbability)) {
				series.push(Math.max(0, Math.min(100, Math.round(yesProbability * 100))));
			}

			return series;
		}, []);
