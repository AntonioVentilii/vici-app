import type { ClearingDid } from '$declarations';
import {
	cancelLimitOrder as cancelLimitOrderApi,
	getOrders as getOrdersApi,
	listOrders as listOrdersApi,
	submitLimitOrder,
	submitMarketOrder
} from '$lib/api/clearing.api';
import { MarketClosedError } from '$lib/canisters/clearing.errors';
import { PRICE_DECIMALS, ZERO } from '$lib/constants/app.constants';
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
	outcome,
	expiryDate
}: {
	marketId: MarketId;
	marketTitle: string;
	side: OrderSide;
	type: OrderType;
	price: number;
	qty: bigint;
	outcome: Outcome;
	expiryDate: bigint;
}): Promise<void> => {
	// Stopgap expiry gate. The deck/catalog is filtered `only_unexpired` at
	// fetch time, but the clearing engine has no expiry check (its `TradeError`
	// has no `Expired` variant — it only rejects settled series), so a deck
	// opened just before kickoff could submit after it. Reject at/after the
	// market's expiry until icdc-core enforces this server-side.
	if (BigInt(Date.now()) >= expiryDate) {
		throw new MarketClosedError();
	}

	// Sizing rounds the stake down to whole contracts (`amountUsd / priceUsd`),
	// so a stake smaller than one contract's price arrives here as zero —
	// reject it before any state changes or activity logging.
	if (qty <= ZERO) {
		throw new Error('Stake is too small for this price — the order quantity rounds to zero');
	}

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

	// What the activity log reports: the full size for a resting limit order,
	// the actually executed size for a market order (the book may be smaller
	// than the request).
	let filledQty = qty;

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
		const counterSide = normalizedSide === 'BUY' ? 'Sell' : 'Buy';

		const targetOutcomeId = outcome === 'YES' || outcome === 'NO' ? undefined : outcome;

		const callerText = identity.getPrincipal().toText();

		const fetchMatchingOrders = async (): Promise<ClearingDid.LimitOrder[]> => {
			const orders = await listOrdersApi({
				identity,
				params: { series_id: toNullable(marketId) }
			});

			return orders
				.filter((o: ClearingDid.LimitOrder) => {
					const isCorrectSide = counterSide in o.side;
					const isCorrectOutcome = o.outcome_id[0] === targetOutcomeId;
					// The engine rejects self-trades; the caller's own resting
					// orders are not liquidity for this market order.
					const isSelf = o.creator.toText() === callerText;

					return isCorrectSide && isCorrectOutcome && !isSelf;
				})
				.sort((a: ClearingDid.LimitOrder, b: ClearingDid.LimitOrder) => {
					const priceA = Number(a.price.decimal.value);
					const priceB = Number(b.price.decimal.value);

					return normalizedSide === 'BUY' ? priceA - priceB : priceB - priceA;
				});
		};

		let matchingOrders = await fetchMatchingOrders();

		if (matchingOrders.length === 0) {
			throw new Error('No matching liquidity found for market order');
		}

		// Walk the book best-price-first, taking `min(remaining, level)` per
		// trade, so the execution honors the caller's stake-derived `qty`
		// rather than whatever size the best resting order happens to carry.
		// The book is re-read between takes: a level shrunk by a concurrent
		// taker would otherwise overstate the fill (the engine executes
		// `min(take, current level)`) and stop the walk early. A book smaller
		// than the request fills what exists. The pass cap is a defensive
		// bound — each pass either reduces `remaining` or exits, so a healthy
		// walk never reaches it.
		const MAX_BOOK_PASSES = 10;
		let remaining = qty;

		try {
			for (let pass = 0; pass < MAX_BOOK_PASSES && remaining > ZERO; pass++) {
				if (pass > 0) {
					matchingOrders = await fetchMatchingOrders();
				}

				const [best] = matchingOrders;

				if (isNullish(best)) {
					break;
				}

				const take = remaining < best.qty ? remaining : best.qty;

				await submitMarketOrder({
					identity,
					params: {
						trade_id: `TRD_${nanoid(8)}`,
						matching_order_id: best.order_id,
						qty: toNullable(take)
					}
				});

				remaining -= take;
			}
		} catch (e: unknown) {
			// Nothing executed — surface the failure. After a partial fill the
			// user holds a real position, so finish with what filled instead
			// of reporting a failure that would read as "nothing happened".
			if (remaining === qty) {
				throw e;
			}

			console.warn('Market order partially filled before an error; keeping the filled amount', e);
		}

		filledQty = qty - remaining;
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
			title: `${side === 'BUY' ? 'Predicted' : type === 'MARKET' ? 'Sold' : 'Placed'} ${filledQty} on ${outcome} @ ${Math.round(normalizedPrice * 100)}%`,
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
