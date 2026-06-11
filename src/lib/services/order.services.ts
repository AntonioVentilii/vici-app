import type { ClearingDid } from '$declarations';
import {
	cancelLimitOrder as cancelLimitOrderApi,
	getOrders as getOrdersApi,
	listOrders as listOrdersApi,
	submitLimitOrder,
	submitMarketOrder
} from '$lib/api/clearing.api';
import { PRICE_DECIMALS } from '$lib/constants/app.constants';
import { ActivityType } from '$lib/enums/social';
import { logActivity } from '$lib/services/activity.services';
import {
	getIdentity,
	getIdentityOrAnonymous,
	safeGetIdentityOnce
} from '$lib/services/identity.services';
import { recordActivity } from '$lib/services/profile.services';
import { loadWithCertification } from '$lib/services/query-update.services';
import type { MarketId, Outcome } from '$lib/types/market';
import type { OrderSide, OrderType } from '$lib/types/order';
import { filterByPlaygroundExpandedDomain } from '$lib/utils/balance-domain.utils';
import { parseLimitOrderPriceValue } from '$lib/utils/parse.utils';
import { refreshAllBalances, refreshOrders, refreshPositions } from '$lib/utils/refresh.utils';
import { isNullish, toNullable, type Nullable } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';
import { getIdentityOnce } from '@junobuild/core';
import { nanoid } from 'nanoid';

/**
 * Core order-book fetch: threads identity + certified so it composes with
 * {@link loadOrderBook} / `queryAndUpdate`.
 */
const fetchOrderBook = async ({
	identity,
	certified,
	marketId,
	domain
}: {
	identity: Identity;
	certified: boolean;
	marketId: MarketId;
	domain?: ClearingDid.BalanceDomain;
}): Promise<ClearingDid.LimitOrder[]> => {
	const orders = await listOrdersApi({
		identity,
		certified,
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

/**
 * Lists open limit orders for a market, optionally filtered to a balance domain.
 *
 * Performs a single certified update. Prefer {@link loadOrderBook} for UI flows
 * that should render fast then upgrade to a certified result.
 */
export const getOrderBook = async ({
	marketId,
	domain,
	identity: identityOverride,
	certified = true
}: {
	marketId: MarketId;
	domain?: ClearingDid.BalanceDomain;
	identity?: Identity;
	certified?: boolean;
}): Promise<ClearingDid.LimitOrder[]> => {
	const identity = identityOverride ?? (await getIdentityOrAnonymous());

	return fetchOrderBook({ identity, certified, marketId, domain });
};

/**
 * Callback-based variant of {@link getOrderBook} that fires `onLoad` up to
 * twice — once for the uncertified query, once for the certified update.
 */
export const loadOrderBook = ({
	marketId,
	domain,
	onLoad,
	onUpdateError
}: {
	marketId: MarketId;
	domain?: ClearingDid.BalanceDomain;
	onLoad: (options: { certified: boolean; response: ClearingDid.LimitOrder[] }) => void;
	onUpdateError?: (error: unknown) => void;
}): Promise<void> =>
	loadWithCertification<ClearingDid.LimitOrder[]>({
		request: ({ certified, identity }) => fetchOrderBook({ identity, certified, marketId, domain }),
		onLoad,
		onUpdateError
	});

/**
 * Submits a limit order or matches a market order against the book; refreshes UI state and logs activity.
 */
export const placeOrder = async ({
	marketId,
	marketTitle,
	side,
	type,
	price,
	qty,
	outcome
}: {
	marketId: MarketId;
	marketTitle: string;
	side: OrderSide;
	type: OrderType;
	price: number;
	qty: bigint;
	outcome: Outcome;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	const isBinary = outcome === 'YES' || outcome === 'NO';
	const normalizedSide: OrderSide = isBinary
		? outcome === 'NO'
			? side === 'BUY'
				? 'SELL'
				: 'BUY'
			: side
		: side;
	const normalizedPrice = isBinary && outcome === 'NO' ? 1 - price : price;
	const outcomeId: Nullable<string> = isBinary ? toNullable() : toNullable(outcome);

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
						value: parseLimitOrderPriceValue(normalizedPrice),
						decimals: PRICE_DECIMALS
					},
					timestamp: toNullable(),
					oracle_id: toNullable()
				},
				qty
			}
		});
	} else {
		const orders = await listOrdersApi({
			identity,
			params: { series_id: toNullable(marketId) }
		});

		const counterSide = normalizedSide === 'BUY' ? 'Sell' : 'Buy';

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
				matching_order_id: bestMatch.order_id,
				// None = fill the entire resting order, the engine's behavior
				// before the optional taker-qty cap existed.
				qty: toNullable()
			}
		});
	}

	refreshPositions();
	refreshOrders();

	refreshAllBalances();

	try {
		const userText = identity.getPrincipal().toText();
		await logActivity({
			type: ActivityType.TRADE,
			user: userText,
			marketId,
			// "Sold" only when the trade executed on the spot; an open limit sell is merely placed.
			// `normalizedPrice` is the price of the chosen outcome — the raw `price` arg arrives
			// YES-framed for binary NO and would display the complement.
			title: `${side === 'BUY' ? 'Predicted' : type === 'MARKET' ? 'Sold' : 'Placed'} ${qty} on ${outcome} @ ${Math.round(normalizedPrice * 100)}%`,
			details: marketTitle
		});
		await recordActivity(userText);
	} catch (e: unknown) {
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

/**
 * Fetches the signed-in user's open orders, filtered to the active balance domain.
 * Threads identity + certified for `queryAndUpdate` compatibility.
 */
const fetchUserOrders = async ({
	identity,
	certified,
	domain
}: {
	identity: Identity;
	certified: boolean;
	domain: ClearingDid.BalanceDomain;
}): Promise<ClearingDid.LimitOrder[]> => {
	const orders = await getOrdersApi({ identity, certified });

	return filterByPlaygroundExpandedDomain({ items: orders, targetDomain: domain });
};

export const getUserOrdersForMarket = async ({
	marketId,
	domain
}: {
	marketId: MarketId;
	domain: ClearingDid.BalanceDomain;
}): Promise<ClearingDid.LimitOrder[]> => {
	const orders = await getUserOrders(domain);

	return orders.filter((o) => o.series_id === marketId);
};

/**
 * All open orders for the current user in the active balance domain.
 * In playground mode (ViciXp), Social-domain orders are included.
 *
 * Performs a single certified update. Returns `[]` when the user is not signed in.
 * Prefer {@link loadUserOrders} for UI flows that benefit from the fast-then-certified
 * render pattern.
 */
export const getUserOrders = async (
	domain: ClearingDid.BalanceDomain
): Promise<ClearingDid.LimitOrder[]> => {
	const identity = await getIdentityOnce();

	if (isNullish(identity)) {
		return [];
	}

	return fetchUserOrders({ identity, certified: true, domain });
};

/**
 * Callback-based variant of {@link getUserOrders}. No-op when the user is not
 * signed in (mirrors `getUserOrders` returning `[]`).
 */
export const loadUserOrders = async ({
	domain,
	onLoad,
	onUpdateError
}: {
	domain: ClearingDid.BalanceDomain;
	onLoad: (options: { certified: boolean; response: ClearingDid.LimitOrder[] }) => void;
	onUpdateError?: (error: unknown) => void;
}): Promise<void> => {
	const identity = await getIdentity();

	if (isNullish(identity)) {
		return;
	}

	return loadWithCertification<ClearingDid.LimitOrder[]>({
		identity,
		request: ({ certified, identity: reqIdentity }) =>
			fetchUserOrders({ identity: reqIdentity, certified, domain }),
		onLoad,
		onUpdateError
	});
};

/**
 * Callback-based variant of {@link getUserOrdersForMarket}. No-op when the user
 * is not signed in.
 */
export const loadUserOrdersForMarket = ({
	marketId,
	domain,
	onLoad,
	onUpdateError
}: {
	marketId: MarketId;
	domain: ClearingDid.BalanceDomain;
	onLoad: (options: { certified: boolean; response: ClearingDid.LimitOrder[] }) => void;
	onUpdateError?: (error: unknown) => void;
}): Promise<void> =>
	loadUserOrders({
		domain,
		onLoad: ({ certified, response }) =>
			onLoad({ certified, response: response.filter((o) => o.series_id === marketId) }),
		onUpdateError
	});
