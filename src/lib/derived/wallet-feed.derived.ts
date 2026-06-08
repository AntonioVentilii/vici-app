import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import { markets } from '$lib/derived/markets.derived';
import { tradeHistory } from '$lib/derived/trade-history.derived';
import type { MarketId } from '$lib/types/market';
import type { Transaction } from '$lib/types/wallet';
import { mapClearingEventToTransaction } from '$lib/utils/transactions.utils';
import { derived, type Readable } from 'svelte/store';

/**
 * Clearing trade-history events projected into the unified `Transaction`
 * shape, pairing each event with its market to resolve the (VXP-denominated)
 * settlement token. The Wallet page merges these with the paged ICRC ledger
 * rows it holds locally; this store owns only the pure clearing → wallet-row
 * projection over the shared `tradeHistory` + `markets` stores.
 */
export const clearingTransactions: Readable<Transaction[]> = derived(
	[tradeHistory, markets],
	([$tradeHistory, $markets]) => {
		if ($tradeHistory.length === 0) {
			return [];
		}

		const marketById = new Map($markets.map((m) => [m.id, m] as const));

		return $tradeHistory.map((event) => {
			const market = marketById.get(event.series_id as MarketId);
			const token = market?.token ?? VXP_TOKEN;

			return mapClearingEventToTransaction({
				event,
				token,
				user: event.user.toText()
			});
		});
	}
);
