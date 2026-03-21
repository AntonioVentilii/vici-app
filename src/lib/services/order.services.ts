import type { ClearingDid } from '$declarations';
import {
	cancelLimitOrder as cancelLimitOrderApi,
	getOrders as getOrdersApi,
	listOrders as listOrdersApi,
	submitLimitOrder,
	submitMarketOrder
} from '$lib/api/clearing.api';
import { PRICE_DECIMALS } from '$lib/constants/app.constants';
import { balanceDomain } from '$lib/derived/balance-domain.derived';
import { logActivity } from '$lib/services/activity.services';
import { getIdentityOrAnonymous, safeGetIdentityOnce } from '$lib/services/identity.services';
import { recordActivity } from '$lib/services/profile.services';
import type { MarketId, Outcome } from '$lib/types/market';
import type { OrderSide, OrderType } from '$lib/types/order';
import { ActivityType } from '$lib/types/social';
import { filterByBalanceDomain } from '$lib/utils/balance-domain.utils';
import { refreshAllBalances, refreshOrders, refreshPositions } from '$lib/utils/refresh.utils';
import { isNullish, toNullable } from '@dfinity/utils';
import { nanoid } from 'nanoid';
import { get } from 'svelte/store';

export const getOrderBook = async ({
	marketId,
	domain
}: {
	marketId: MarketId;
	domain?: ClearingDid.BalanceDomain;
}): Promise<ClearingDid.LimitOrder[]> => {
	const identity = await getIdentityOrAnonymous();

	const orders = await listOrdersApi({
		identity,
		params: { series_id: toNullable(marketId) }
	});

	if (isNullish(domain)) {
		return orders;
	}

	return orders.filter((o) => {
		const [orderDomain] = Object.keys(o.balance_domain);
		const [targetDomain] = Object.keys(domain);
		return orderDomain === targetDomain;
	});
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
	let normalizedSide = side;
	let normalizedPrice = price;
	let outcomeId: [] | [string] = toNullable();

	// Check if it's a binary market (YES/NO) vs Categorical
	// For now we assume YES/NO are special strings for Binary
	if (outcome === 'YES' || outcome === 'NO') {
		normalizedSide = outcome === 'NO' ? (side === 'BUY' ? 'SELL' : 'BUY') : side;
		normalizedPrice = outcome === 'NO' ? 1 - price : price;
		outcomeId = toNullable(); // Use default (usually first outcome) for binary
	} else {
		// Categorical: use outcome directly as outcome_id
		outcomeId = toNullable(outcome);
	}

	if (type === 'LIMIT') {
		const orderId = `ORD_${nanoid(8)}`;

		await submitLimitOrder({
			identity,
			params: {
				order_id: orderId,
				series_id: marketId,
				side: normalizedSide === 'BUY' ? { Buy: null } : { Sell: null },
				outcome_id: outcomeId,
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

		// Identify the target outcome for binary vs categorical
		const targetOutcomeId = outcome === 'YES' || outcome === 'NO' ? undefined : outcome;

		const matchingOrders = orders
			.filter((o: ClearingDid.LimitOrder) => {
				const isCorrectSide = counterSide in o.side;
				const isCorrectOutcome = o.outcome_id[0] === targetOutcomeId;
				return isCorrectSide && isCorrectOutcome;
			})
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

	refreshPositions();
	refreshOrders();

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
		await recordActivity(userText);
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

	refreshPositions();

	refreshOrders();

	refreshAllBalances();
};

export const getUserOrdersForMarket = async (
	marketId: MarketId
): Promise<ClearingDid.LimitOrder[]> => {
	const orders = await getUserOrders();

	return orders.filter((o) => o.series_id === marketId);
};

export const getUserOrders = async (): Promise<ClearingDid.LimitOrder[]> => {
	const identity = await safeGetIdentityOnce();

	const orders = await getOrdersApi({
		identity
	});

	const domain = get(balanceDomain);

	return filterByBalanceDomain({ items: orders, targetDomain: domain });
};
