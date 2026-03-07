import type { ClearingDid } from '$declarations';
import {
	cancelLimitOrder as cancelLimitOrderApi,
	submitLimitOrder,
	submitMarketOrder
} from '$lib/api/clearing.api';
import { PRICE_DECIMALS, ZERO } from '$lib/constants/app.constants';
import { Collection } from '$lib/constants/collections.constants';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import type { MarketId, Outcome } from '$lib/types/market';
import type { Order, OrderBook, OrderBookLevel, OrderSide, OrderType } from '$lib/types/order';
import { parseToken } from '$lib/utils/parse.utils';
import { emitRefreshBalance, emitRefreshPositions } from '$lib/utils/refresh.utils';
import { nonNullish, toNullable } from '@dfinity/utils';
import { deleteDoc, listDocs, setDoc } from '@junobuild/core';
import { nanoid } from 'nanoid';

export const getOrderBook = async (marketId: MarketId): Promise<OrderBook> => {
	const { items } = await listDocs<Order>({
		collection: Collection.ORDERS
	});

	const marketOrders = items
		.map((doc) => doc.data)
		.filter((o) => o.marketId === marketId && o.status === 'OPEN');

	const bids: OrderBookLevel[] = [];
	const asks: OrderBookLevel[] = [];

	marketOrders.forEach((o) => {
		const target = o.side === 'BUY' ? bids : asks;

		const existing = target.find((l) => l.price === o.price);

		if (nonNullish(existing)) {
			existing.totalQty = o.qty - o.filledQty;

			existing.orderCount = 1;
		} else {
			target.push({
				price: o.price,
				totalQty: o.qty - o.filledQty,
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
	const userPrincipal = identity.getPrincipal().toText();

	// Normalize Binary Outcome to "YES" asset
	// BUY NO @ 0.4 = SELL YES @ 0.6
	// SELL NO @ 0.4 = BUY YES @ 0.6
	const normalizedSide = outcome === 'NO' ? (side === 'BUY' ? 'SELL' : 'BUY') : side;
	const normalizedPrice = outcome === 'NO' ? 1 - price : price;

	if (type === 'LIMIT') {
		const orderId = `ORD_${nanoid(8)}`;

		const price = parseToken({ value: `${normalizedPrice}`, unitName: PRICE_DECIMALS });

		const params: ClearingDid.SubmitLimitOrderParams = {
			order_id: orderId,
			series_id: marketId,
			side: normalizedSide === 'BUY' ? { Buy: null } : { Sell: null },
			price: {
				decimal: {
					value: price,
					decimals: PRICE_DECIMALS
				},
				timestamp: toNullable(),
				oracle_id: toNullable()
			},
			qty
		};

		// 1. Submit to Canister (Blocks Collateral)
		await submitLimitOrder({
			identity,
			params
		});

		// 2. Save to Juno for Discovery
		const order: Order = {
			id: orderId,
			marketId,
			owner: userPrincipal,
			side: normalizedSide,
			outcome: 'YES', // Always stored as YES outcome for book consistency
			price: normalizedPrice,
			qty,
			initQty: qty,
			filledQty: ZERO,
			status: 'OPEN',
			createdAt: BigInt(Date.now())
		};

		await setDoc({
			collection: Collection.ORDERS,
			doc: {
				key: orderId,
				data: order
			}
		});
	} else {
		// MARKET ORDER (Taker)
		// 1. Find best matching order in Juno
		const counterSide = normalizedSide === 'BUY' ? 'SELL' : 'BUY';
		const { items: counterDocs } = await listDocs<Order>({
			collection: Collection.ORDERS
		});

		const [bestMatch] = counterDocs
			.map((doc) => ({ ...doc.data, key: doc.key }))
			.filter((o) => o.marketId === marketId && o.side === counterSide && o.status === 'OPEN')
			.sort((a, b) => (normalizedSide === 'BUY' ? a.price - b.price : b.price - a.price));

		if (!bestMatch) {
			throw new Error('No matching liquidity found for market order');
		}

		// 2. Submit Market Order to Canister (Executes Swap)
		const tradeId = `TRD_${nanoid(8)}`;
		await submitMarketOrder({
			identity,
			params: {
				trade_id: tradeId,
				matching_order_id: bestMatch.id
			}
		});

		// 3. Update Juno (Mark as filled/delete)
		// Note: In a real system, the canister might handle partial fills.
		// For now we assume full or simple fill logic.
		await deleteDoc({
			collection: Collection.ORDERS,
			doc: {
				key: bestMatch.key,
				data: bestMatch
			}
		});
	}

	emitRefreshPositions();
	emitRefreshBalance();
};

export const cancelLimitOrder = async (orderId: string): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	// 1. Cancel in Canister (Unblocks Collateral)
	await cancelLimitOrderApi({
		identity,
		params: {
			order_id: orderId
		}
	});

	// 2. Remove from Juno
	const { items } = await listDocs<Order>({
		collection: Collection.ORDERS
	});
	const orderDoc = items.find((doc) => (doc.data as Order).id === orderId);

	if (orderDoc) {
		await deleteDoc({
			collection: Collection.ORDERS,
			doc: orderDoc
		});
	}

	emitRefreshPositions();
	emitRefreshBalance();
};
