import type { ClearingDid, RegistryDid } from '$declarations';
import { MILLISECOND_IN_NANOSECONDS, ZERO } from '$lib/constants/app.constants';
import type { Market, MarketStatus, Outcome, TradingAccessUI } from '$lib/types/market';
import type { OrderBookLevel } from '$lib/types/order';
import { decimalFixedValueToNumber } from '$lib/utils/format.utils';
import { resolveMarketDisplayToken } from '$lib/utils/market-token.utils';
import { parseMarketId } from '$lib/validation/market.validation';
import { isNullish, nonNullish } from '@dfinity/utils';

/**
 * Builds a `Market` view model from registry series and optional book/probability fields.
 */
export const mapMarketData = ({
	series,
	yesProbability = 0,
	noProbability = 0,
	bestBid = undefined,
	bestAsk = undefined,
	bestBidQty = undefined,
	bestAskQty = undefined,
	status = 'Open',
	outcome = undefined,
	categoricalProbabilities = undefined
}: {
	series: RegistryDid.Series;
	yesProbability?: number;
	noProbability?: number;
	bestBid?: number;
	bestAsk?: number;
	bestBidQty?: bigint;
	bestAskQty?: bigint;
	status?: MarketStatus;
	outcome?: Outcome;
	categoricalProbabilities?: Record<string, number>;
}): Market | undefined => {
	const {
		series_id: id,
		expiry_ns: expiryDate,
		creator,
		title,
		description: { plain: description },
		payout_unit: payoutUnit,
		payoff_type: payoffType,
		outcomes,
		balance_domain: balanceDomain,
		trading_access: rawTradingAccess,
		forked_from: forkedFromOpt
	} = series;

	const token = resolveMarketDisplayToken({ balanceDomain, payoutUnit });

	if (isNullish(token)) {
		return;
	}

	const payoffTypeMapped: Market['payoffType'] =
		'Categorical' in payoffType
			? 'Categorical'
			: 'Call' in payoffType
				? 'Call'
				: 'Put' in payoffType
					? 'Put'
					: 'Binary';

	const tradingAccess: TradingAccessUI[] = mapTradingAccess(rawTradingAccess);
	const isInviteOnly = tradingAccess.length > 0 && !tradingAccess.some((a) => a.type === 'Open');

	return {
		id: parseMarketId(id),
		title,
		description,
		creator: creator.toText(),
		expiryDate: expiryDate / MILLISECOND_IN_NANOSECONDS,
		createdAt: series.created_at_ns / MILLISECOND_IN_NANOSECONDS,
		status,
		outcome,
		outcomes: outcomes?.[0]?.map((o) => ({
			id: o.id,
			title: o.title,
			probability: payoffTypeMapped === 'Categorical' ? categoricalProbabilities?.[o.id] : undefined
		})),
		payoffType: payoffTypeMapped,
		isInviteOnly,
		inviteList: [],
		tradingAccess,
		totalVolume: ZERO,
		yesVolume: ZERO,
		noVolume: ZERO,
		yesProbability,
		noProbability,
		bestBid,
		bestAsk,
		bestBidQty,
		bestAskQty,
		token,
		pricePrecision: Number(series.price_precision),
		balanceDomain,
		forkedFrom: forkedFromOpt?.[0] !== undefined ? parseMarketId(forkedFromOpt[0]) : undefined
	};
};

/**
 * Mid-price estimate from bid/ask levels (0.5 if empty, else best bid/ask or one-sided).
 */
export const calculateProbability = ({
	bids,
	asks
}: {
	bids: OrderBookLevel[];
	asks: OrderBookLevel[];
}): number => {
	if (bids.length === 0 && asks.length === 0) {
		return 0.5;
	}

	if (bids.length > 0 && asks.length > 0) {
		const bestBid = bids[0].price;
		const bestAsk = asks[0].price;

		return (bestBid + bestAsk) / 2;
	}

	if (bids.length > 0) {
		return bids[0].price;
	}

	return asks[0].price;
};

/**
 * Aggregates clearing limit orders into sorted bid/ask ladders and mid-price for an outcome.
 */
export const calculateMarketStats = ({
	orders,
	outcome = 'YES'
}: {
	orders: ClearingDid.LimitOrder[];
	outcome?: string;
}) => {
	const isBinarySide = outcome === 'YES' || outcome === 'NO';

	const normalizedOrders = orders
		.map((o) => {
			const side = 'Buy' in o.side ? 'BUY' : 'SELL';
			const oOutcomeId = o.outcome_id[0] ?? 'YES';
			const rawPrice = decimalFixedValueToNumber({
				value: o.price.decimal.value,
				decimals: o.price.decimal.decimals
			});

			if (oOutcomeId === outcome) {
				return { displaySide: side, displayPrice: rawPrice, qty: o.qty };
			}

			const isOrderBinarySide = oOutcomeId === 'YES' || oOutcomeId === 'NO';

			if (isBinarySide && isOrderBinarySide) {
				return {
					displaySide: side === 'BUY' ? ('SELL' as const) : ('BUY' as const),
					displayPrice: 1 - rawPrice,
					qty: o.qty
				};
			}
		})
		.filter(nonNullish);

	const aggregateByPrice = (entries: typeof normalizedOrders): OrderBookLevel[] =>
		Array.from(
			entries
				.reduce<Map<number, OrderBookLevel>>((acc, { displayPrice, qty }) => {
					const key = Math.round(displayPrice * 1e6) / 1e6;
					const existing = acc.get(key);

					acc.set(key, {
						price: key,
						totalQty: (existing?.totalQty ?? ZERO) + qty,
						orderCount: (existing?.orderCount ?? 0) + 1
					});

					return acc;
				}, new Map())
				.values()
		);

	const bids = aggregateByPrice(normalizedOrders.filter((o) => o.displaySide === 'BUY')).sort(
		(a, b) => b.price - a.price
	);
	const asks = aggregateByPrice(normalizedOrders.filter((o) => o.displaySide === 'SELL')).sort(
		(a, b) => a.price - b.price
	);

	return {
		bids,
		asks,
		midPrice: calculateProbability({ bids, asks })
	};
};

/**
 * Human-readable time until `expiry` (ms since epoch) or `"Expired"`.
 */
export const getTimeRemaining = (expiry: bigint): string => {
	const now = BigInt(Date.now());
	const diff = Number(expiry - now);

	if (diff <= 0) {
		return 'Expired';
	}

	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

	if (days > 0) {
		return `${days}d ${hours}h`;
	}

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}

	return `${minutes}m remaining`;
};

/**
 * Normalized implied probabilities per categorical outcome from order book top of book.
 */
export const calculateCategoricalProbabilities = ({
	outcomes,
	orders
}: {
	outcomes: { id: string; title: string }[];
	orders: ClearingDid.LimitOrder[];
}): Record<string, number> => {
	const orderPrice = (order: ClearingDid.LimitOrder): number =>
		decimalFixedValueToNumber({
			value: order.price.decimal.value,
			decimals: order.price.decimal.decimals
		});

	const outcomeBook = outcomes.reduce<Record<string, { bestBid?: number; bestAsk?: number }>>(
		(acc, o) => {
			const outcomeOrders = orders.filter((order) => order.outcome_id[0] === o.id);
			const [bestBid] = outcomeOrders
				.filter((order) => 'Buy' in order.side)
				.map(orderPrice)
				.sort((a, b) => b - a);
			const [bestAsk] = outcomeOrders
				.filter((order) => 'Sell' in order.side)
				.map(orderPrice)
				.sort((a, b) => a - b);

			acc[o.id] = { bestBid, bestAsk };

			return acc;
		},
		{}
	);

	const rawProbs = outcomes.reduce<Record<string, number>>((acc, o) => {
		const { bestBid, bestAsk } = outcomeBook[o.id];

		acc[o.id] =
			nonNullish(bestBid) && nonNullish(bestAsk)
				? (bestBid + bestAsk) / 2
				: nonNullish(bestBid)
					? bestBid
					: nonNullish(bestAsk)
						? bestAsk
						: 1 / outcomes.length;

		return acc;
	}, {});

	const totalWeight = Object.values(rawProbs).reduce((sum, p) => sum + p, 0);

	if (totalWeight <= 0) {
		return rawProbs;
	}

	return Object.fromEntries(Object.entries(rawProbs).map(([id, p]) => [id, p / totalWeight]));
};

const mapTradingAccess = (
	raw: RegistryDid.Series['trading_access'] | undefined
): TradingAccessUI[] => {
	if (!raw || raw.length === 0) {
		return [{ type: 'Open' }];
	}

	return raw.map((policy) => {
		if ('Open' in policy) {
			return { type: 'Open' as const };
		}

		if ('Restricted' in policy) {
			return {
				type: 'Restricted' as const,
				groupIds: policy.Restricted.groups.map((g) => g)
			};
		}

		return { type: 'Open' as const };
	});
};

/**
 * Badge/variant hint for market or resolution outcome labels.
 */
export const getOutcomeVariant = (
	outcome: string | undefined
): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
	if (outcome === 'YES' || outcome === 'Open' || outcome === 'Resolved') {
		return 'success';
	}

	if (outcome === 'NO' || outcome === 'Canceled') {
		return 'danger';
	}

	return 'default';
};
