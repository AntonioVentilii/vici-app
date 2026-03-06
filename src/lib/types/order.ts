import type { MarketId, Outcome } from '$lib/types/market';
import type { PrincipalText } from '@dfinity/zod-schemas';

export type OrderType = 'LIMIT' | 'MARKET';

export type OrderSide = 'BUY' | 'SELL';

export interface Order {
	id: string;
	marketId: MarketId;
	owner: PrincipalText;
	side: OrderSide;
	outcome: Outcome;
	price: number; // 0.0 to 1.0
	qty: bigint;
	initQty: bigint;
	filledQty: bigint;
	status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED';
	createdAt: bigint;
}

export interface OrderBookLevel {
	price: number;
	totalQty: bigint;
	orderCount: number;
}

export interface OrderBook {
	marketId: MarketId;
	outcome: Outcome;
	bids: OrderBookLevel[]; // Buy YES
	asks: OrderBookLevel[]; // Sell YES
}
