import type { ClearingDid } from '$declarations';
import { decimalFixedValueToNumber } from '$lib/utils/format.utils';

const isExecuted = (event: ClearingDid.Event): boolean => 'Executed' in event.event_type;

/**
 * Real per-series price history, derived from the caller's executed
 * trades on the clearing canister.
 *
 * `get_trade_history` is caller-scoped — it returns the current user's
 * own events, each carrying the YES price the trade executed at. We
 * keep the `Executed` events for the requested series, sort them
 * chronologically, and map each price to a 0–100 YES percentage. This
 * is genuine (if viewer-relative) market history, not synthetic jitter:
 * a market on which the viewer has never traded yields an empty series,
 * which the sparkline reads as a true cold-start flat line.
 *
 * @returns YES percentages (0–100) in trade order, oldest first. Empty
 *   when there are no executed trades for the series.
 */
export const deriveMarketPriceHistory = ({
	events,
	seriesId
}: {
	events: ClearingDid.Event[];
	seriesId: string;
}): number[] =>
	events
		.filter((event) => event.series_id === seriesId && isExecuted(event))
		.slice()
		.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0))
		.map((event) => {
			const yesProbability = decimalFixedValueToNumber({
				value: event.price.decimal.value,
				decimals: event.price.decimal.decimals
			});

			if (!Number.isFinite(yesProbability)) {
				return 50;
			}

			return Math.max(0, Math.min(100, Math.round(yesProbability * 100)));
		});
