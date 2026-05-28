import type { ClearingDid } from '$declarations';
import { ZERO } from '$lib/constants/app.constants';
import type { Market } from '$lib/types/market';
import type { ResolvedPosition } from '$lib/types/position';
import { parseMarketId } from '$lib/validation/market.validation';

/**
 * `EventType` shape from `@dfinity/candid` is a tagged union. This guard
 * keeps the call sites readable without sprinkling `'Settled' in` checks
 * everywhere.
 */
export const isSettledEvent = (event: ClearingDid.Event): boolean => 'Settled' in event.event_type;

/**
 * Maps a clearing-canister `Settled` event into a {@link ResolvedPosition}.
 *
 * The event's signed `qty` carries the user's realized `cashflow_usd`
 * (positive = winner, negative = loser). Combined with the market's
 * recorded outcome it's enough to render W/L glyphs and PnL without
 * needing a live `Position` row (which the clearing canister deletes
 * during settlement).
 *
 * The `market` parameter is optional so callers can map events even when
 * the market list hasn't fully loaded — `outcomeId` simply stays `undefined`
 * in that case rather than fabricating a side.
 */
export const settledEventToResolvedPosition = ({
	event,
	market
}: {
	event: ClearingDid.Event;
	market?: Pick<Market, 'outcome'>;
}): ResolvedPosition => {
	const result: ResolvedPosition['result'] =
		event.qty > ZERO ? 'won' : event.qty < ZERO ? 'lost' : 'neutral';

	// Only winners' outcomeId is recoverable from a single event — they
	// must have held the winning outcome. Losers could have held any
	// non-winning outcome (especially on categorical markets), so we
	// leave `outcomeId` undefined for them rather than guess.
	const outcomeId = result === 'won' ? market?.outcome : undefined;

	return {
		marketId: parseMarketId(event.series_id),
		outcomeId,
		realizedPnlUsd: event.qty,
		result,
		timestampNs: event.timestamp,
		eventId: event.event_id
	};
};
