import type { ClearingDid, RegistryDid } from '$declarations';
import { NANO_SECONDS_IN_MILLISECOND, ZERO } from '$lib/constants/app.constants';
import type { Market, MarketStatus, Outcome } from '$lib/types/market';
import type { OrderBookLevel } from '$lib/types/order';
import { assetToToken } from '$lib/utils/asset.utils';
import { parseMarketId } from '$lib/validation/market.validation';
import { isNullish, nonNullish } from '@dfinity/utils';

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
		balance_domain: balanceDomain
	} = series;

	const token = assetToToken(payoutUnit);

	if (isNullish(token)) {
		return;
	}

	let payoffTypeMapped: Market['payoffType'] = 'Binary';
	if ('Categorical' in payoffType) {
		payoffTypeMapped = 'Categorical';
	}
	if ('Call' in payoffType) {
		payoffTypeMapped = 'Call';
	}
	if ('Put' in payoffType) {
		payoffTypeMapped = 'Put';
	}

	return {
		id: parseMarketId(id),
		title,
		description,
		creator: creator.toText(),
		expiryDate: expiryDate / NANO_SECONDS_IN_MILLISECOND,
		createdAt: series.created_at_ns / NANO_SECONDS_IN_MILLISECOND,
		status,
		outcome,
		outcomes: outcomes?.[0]?.map((o) => ({
			id: o.id,
			title: o.title,
			probability: payoffTypeMapped === 'Categorical' ? categoricalProbabilities?.[o.id] : undefined
		})),
		payoffType: payoffTypeMapped,
		isInviteOnly: false,
		inviteList: [],
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
		balanceDomain
	};
};

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

	const sortedBids = bids.sort((a, b) => b.price - a.price);
	const sortedAsks = asks.sort((a, b) => a.price - b.price);

	if (bids.length > 0 && asks.length > 0) {
		const bestBid = sortedBids[0].price;
		const bestAsk = sortedAsks[0].price;
		return (bestBid + bestAsk) / 2;
	}

	if (bids.length > 0) {
		return sortedBids[0].price;
	}

	// asks.length > 0
	return sortedAsks[0].price;
};

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

export const calculateCategoricalProbabilities = ({
	outcomes,
	orders
}: {
	outcomes: { id: string; title: string }[];
	orders: ClearingDid.LimitOrder[];
}): Record<string, number> => {
	const outcomeBook: Record<string, { bestBid?: number; bestAsk?: number }> = {};

	outcomes.forEach((o) => {
		const outcomeOrders = orders.filter((order) => order.outcome_id[0] === o.id);
		const bids = outcomeOrders
			.filter((order) => 'Buy' in order.side)
			.map((order) => Number(order.price.decimal.value) / 10 ** order.price.decimal.decimals)
			.sort((a, b) => b - a);
		const asks = outcomeOrders
			.filter((order) => 'Sell' in order.side)
			.map((order) => Number(order.price.decimal.value) / 10 ** order.price.decimal.decimals)
			.sort((a, b) => a - b);

		outcomeBook[o.id] = {
			bestBid: bids[0],
			bestAsk: asks[0]
		};
	});

	const probs: Record<string, number> = {};
	let totalWeight = 0;

	outcomes.forEach((o) => {
		const { bestBid, bestAsk } = outcomeBook[o.id];
		let p = 0;
		if (nonNullish(bestBid) && nonNullish(bestAsk)) {
			p = (bestBid + bestAsk) / 2;
		} else if (nonNullish(bestBid)) {
			p = bestBid;
		} else if (nonNullish(bestAsk)) {
			p = bestAsk;
		} else {
			p = 1 / outcomes.length; // Default to uniform
		}
		probs[o.id] = p;
		totalWeight += p;
	});

	// Normalize
	if (totalWeight > 0) {
		Object.keys(probs).forEach((id) => {
			probs[id] = probs[id] / totalWeight;
		});
	}

	return probs;
};

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
