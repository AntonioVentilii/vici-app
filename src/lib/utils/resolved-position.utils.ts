import type { ClearingDid } from '$declarations';
import { ZERO } from '$lib/constants/app.constants';
import type { Market, MarketId, OutcomeId } from '$lib/types/market';
import type { ResolvedPosition } from '$lib/types/position';

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
 * Callers pass a pre-parsed `marketId` (and optionally the `Market`) so
 * the validation cost is paid once per event regardless of how many
 * derived projections consume the same record.
 */
export const settledEventToResolvedPosition = ({
	event,
	marketId,
	market
}: {
	event: ClearingDid.Event;
	marketId: MarketId;
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
		marketId,
		outcomeId,
		realizedPnlUsd: event.qty,
		result,
		timestampNs: event.timestamp,
		eventId: event.event_id
	};
};

/**
 * Recover the outcome the user held on a resolved market.
 *
 * - Winners' `outcomeId` is already on the record (set by
 *   {@link settledEventToResolvedPosition} from `market.outcome`).
 * - Binary losers' side is the deterministic opposite of the winning
 *   outcome — YES/NO is exclusive on binary markets.
 * - Categorical losers can't be disambiguated from a single Settled
 *   event (they could have held any non-winning outcome), so the
 *   helper returns `undefined` and lets call sites render a placeholder.
 *
 * Centralised here so the inference rule has a single source of truth
 * across the Portfolio rows, market detail "MY CALL" fallback, and any
 * future surfaces that need to render a user's side on a settled market.
 */
export const inferResolvedOutcomeId = ({
	resolved,
	market
}: {
	resolved: Pick<ResolvedPosition, 'outcomeId'>;
	market?: Pick<Market, 'payoffType' | 'outcome'>;
}): OutcomeId | undefined => {
	if (resolved.outcomeId !== undefined) {
		return resolved.outcomeId;
	}

	if (market?.payoffType === 'Binary') {
		if (market.outcome === 'YES') {
			return 'NO';
		}

		if (market.outcome === 'NO') {
			return 'YES';
		}
	}

	// Categorical losers can't be disambiguated; let the function fall
	// through with no explicit return — callers treat absence as
	// "unknown side".
};
