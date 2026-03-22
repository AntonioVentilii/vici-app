import { placeOrder } from '$lib/services/order.services';
import type { Market } from '$lib/types/market';
import type { OrderType } from '$lib/types/order';
import {
	parseToken,
	parseUsdBaseUnitsFromDecimal,
	tokenBaseUnitsToUsdBaseUnits
} from '$lib/utils/parse.utils';
import { nonNullish } from '@dfinity/utils';

/** Parameters for placing an outcome trade from the flow or manual UI. */
export interface TradeParams {
	market: Market;
	action: 'YES' | 'NO' | string;
	amount: string;
	orderType?: OrderType;
	/** Normalized limit price in `[0, 1]` when `orderType` is LIMIT. */
	limitPrice?: number;
}

/** Computes execution price and quantity, then submits a buy via `placeOrder`. */
export const executeOutcomeTrade = async ({
	market,
	action,
	amount,
	orderType = 'MARKET',
	limitPrice
}: TradeParams): Promise<void> => {
	const amountBase = parseToken({ value: amount.trim(), unitName: market.token.decimals });

	let executionPrice: number;

	let type: OrderType = orderType;

	if (orderType === 'LIMIT' && nonNullish(limitPrice)) {
		executionPrice = limitPrice;
	} else {
		// MARKET Logic
		if (action === 'YES') {
			executionPrice = market.bestAsk ?? market.yesProbability;
			type = nonNullish(market.bestAsk) ? 'MARKET' : 'LIMIT';
		} else if (action === 'NO') {
			// For NO, we buy the NO outcome.
			// The price for NO is 1 - price for YES.
			// bestBid is the price for YES, so 1 - bestBid is the price for NO.
			executionPrice = nonNullish(market.bestBid) ? 1 - market.bestBid : market.noProbability;
			type = nonNullish(market.bestBid) ? 'MARKET' : 'LIMIT';
		} else {
			// Categorical or other custom outcome
			const outcome = market.outcomes?.find((o) => o.id === action);
			executionPrice = outcome?.probability ?? 0.5;
			type = 'LIMIT'; // Default to limit for categorical market orders for now
		}
	}

	// Safety: Ensure price is not zero
	const finalPrice = Math.max(executionPrice, 0.01);

	// Clearing margin is `qty * price` in USD `USD_DECIMALS` (see `get_required_margin`). Convert
	// collateral from token base units to that USD scale (1 token ≈ 1 USD notionally for sizing).
	const amountUsd = tokenBaseUnitsToUsdBaseUnits({
		amount: amountBase,
		tokenDecimals: market.token.decimals
	});
	const priceUsd = parseUsdBaseUnitsFromDecimal(finalPrice);
	const qty = amountUsd / priceUsd;

	const isBinary = market.payoffType === 'Binary';

	await placeOrder({
		marketId: market.id,
		side: 'BUY',
		type,
		// For binary "NO", the protocol expects (1 - price) if we are effectively buying YES at a low price
		// Actually, placeOrder handles categorical normalization.
		// If binary and NO, price = 1 - finalPrice
		price: isBinary && action === 'NO' ? 1 - finalPrice : finalPrice,
		qty,
		outcome: action
	});
};
