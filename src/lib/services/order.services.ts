import type { ClearingDid } from '$declarations';
import {
	cancelLimitOrder as cancelLimitOrderApi,
	getOrders as getOrdersApi,
	listOrders as listOrdersApi,
	submitLimitOrder,
	submitMarketOrder
} from '$lib/api/clearing.api';
import { PRICE_DECIMALS } from '$lib/constants/app.constants';
import { logActivity } from '$lib/services/activity.services';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import type { MarketId, Outcome } from '$lib/types/market';
import type { OrderBook, OrderBookLevel, OrderSide, OrderType } from '$lib/types/order';
import { ActivityType } from '$lib/types/social';
import { emitRefreshPositions, refreshAllBalances } from '$lib/utils/refresh.utils';
import { nonNullish, toNullable } from '@dfinity/utils';
import { nanoid } from 'nanoid';

export const getOrderBook = async (marketId: MarketId): Promise<OrderBook> => {
	const identity = await safeGetIdentityOnce();

	const orders = await listOrdersApi({
		identity,
		params: { series_id: toNullable(marketId) }
	});

	const bids: OrderBookLevel[] = [];
	const asks: OrderBookLevel[] = [];

	orders.forEach((o: ClearingDid.LimitOrder) => {
		const side = 'Buy' in o.side ? 'BUY' : 'SELL';
		const target = side === 'BUY' ? bids : asks;
		const price = Number(o.price.decimal.value) / 10 ** o.price.decimal.decimals;

		const existing = target.find((l) => l.price === price);

		if (nonNullish(existing)) {
			existing.totalQty += o.qty;
			existing.orderCount += 1;
		} else {
			target.push({
				price,
				totalQty: o.qty,
				orderCount: 1
			});
		}
	});

	return {
		marketId,
		outcome: 'YES',
		bids: bids.sort((a, b) => b.price - a.price),
		asks: asks.sort((a, b) => a.price - b.price)
	};
};

export const placeOrder = async ({
	marketId,
	side,
	type,
	price,
	qty,
	outcome
}: {
	marketId: MarketId;
	side: OrderSide;
	type: OrderType;
	price: number;
	qty: bigint;
	outcome: Outcome;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	// Normalize Binary Outcome to "YES" asset
	// price is expected as probability (0-1)
	const normalizedSide = outcome === 'NO' ? (side === 'BUY' ? 'SELL' : 'BUY') : side;
	const normalizedPrice = outcome === 'NO' ? 1 - price : price;

	if (type === 'LIMIT') {
		const orderId = `ORD_${nanoid(8)}`;

		await submitLimitOrder({
			identity,
			params: {
				order_id: orderId,
				series_id: marketId,
				side: normalizedSide === 'BUY' ? { Buy: null } : { Sell: null },
				price: {
					decimal: {
						value: BigInt(Math.round(normalizedPrice * 10 ** PRICE_DECIMALS)),
						decimals: PRICE_DECIMALS
					},
					timestamp: toNullable(),
					oracle_id: toNullable()
				},
				qty
			}
		});
	} else {
		// MARKET ORDER (Taker)
		const orders = await listOrdersApi({
			identity,
			params: { series_id: toNullable(marketId) }
		});

		const counterSide = normalizedSide === 'BUY' ? 'Sell' : 'Buy';

		const matchingOrders = orders
			.filter((o: ClearingDid.LimitOrder) => counterSide in o.side)
			.sort((a: ClearingDid.LimitOrder, b: ClearingDid.LimitOrder) => {
				const priceA = Number(a.price.decimal.value);
				const priceB = Number(b.price.decimal.value);
				return normalizedSide === 'BUY' ? priceA - priceB : priceB - priceA;
			});

		const [bestMatch] = matchingOrders;

		if (!bestMatch) {
			throw new Error('No matching liquidity found for market order');
		}

		await submitMarketOrder({
			identity,
			params: {
				trade_id: `TRD_${nanoid(8)}`,
				matching_order_id: bestMatch.order_id
			}
		});
	}

	emitRefreshPositions();

	refreshAllBalances();

	// Log Social Activity (Vici Social Features)
	try {
		const userText = identity.getPrincipal().toText();
		await logActivity({
			type: ActivityType.TRADE,
			user: userText,
			marketId,
			title: `Placed ${side} ${type} order`,
			details: `${side} ${qty} on ${outcome} @ ${price}`
		});
	} catch (e) {
		console.error('Failed to log trade activity', e);
	}
};

export const cancelLimitOrder = async (orderId: string): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	await cancelLimitOrderApi({
		identity,
		params: {
			order_id: orderId
		}
	});

	emitRefreshPositions();

	refreshAllBalances();
};

export const getUserOrders = async (): Promise<ClearingDid.LimitOrder[]> => {
	const identity = await safeGetIdentityOnce();

	return await getOrdersApi({
		identity
	});
};
