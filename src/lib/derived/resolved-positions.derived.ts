import { markets } from '$lib/derived/markets.derived';
import { tradeHistory, tradeHistoryNotInitialized } from '$lib/derived/trade-history.derived';
import type { ResolvedPosition } from '$lib/types/position';
import { isSettledEvent, settledEventToResolvedPosition } from '$lib/utils/resolved-position.utils';
import { parseMarketId } from '$lib/validation/market.validation';
import { derived, type Readable } from 'svelte/store';

/**
 * Resolved positions synthesized from the user's `Settled` events. Replaces
 * the previous `$positions` filter on `market.status === 'Resolved'`, which
 * never returned anything because the clearing canister deletes positions
 * at settlement (see `prepare_settlement_impl` in `icdc-core`).
 *
 * Ordered newest-first so the Portfolio "Resolved" section, market detail,
 * and inbox all share one canonical sort. Joins each event to its `Market`
 * so consumers don't have to do the lookup themselves.
 */
export const resolvedPositions: Readable<ResolvedPosition[]> = derived(
	[tradeHistory, markets],
	([$tradeHistory, $markets]) => {
		const marketById = new Map($markets.map((m) => [m.id, m]));

		return $tradeHistory
			.filter(isSettledEvent)
			.map((event) => {
				// Parse once and pass both pieces into the mapper so the
				// validation cost is paid exactly once per event.
				const marketId = parseMarketId(event.series_id);

				return settledEventToResolvedPosition({
					event,
					marketId,
					market: marketById.get(marketId)
				});
			})
			.sort((a, b) => {
				// bigint compare without losing precision through Number.
				if (a.timestampNs === b.timestampNs) {
					return 0;
				}

				return a.timestampNs > b.timestampNs ? -1 : 1;
			});
	}
);

/**
 * Mirrors `positionsNotInitialized` semantics: true while the underlying
 * trade-history fetch hasn't completed yet, so the Portfolio surface can
 * show a skeleton instead of an "empty resolved list" flash.
 */
export const resolvedPositionsNotInitialized: Readable<boolean> = tradeHistoryNotInitialized;
