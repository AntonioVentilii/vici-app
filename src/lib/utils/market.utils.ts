import type { RegistryDid } from '$declarations';
import { NANO_SECONDS_IN_MILLISECOND, ZERO } from '$lib/constants/app.constants';
import type { Market, MarketStatus, Outcome } from '$lib/types/market';
import type { OrderBookLevel } from '$lib/types/order';
import { assetToToken } from '$lib/utils/asset.utils';
import { parseMarketId } from '$lib/validation/market.validation';
import { isNullish } from '@dfinity/utils';

export const mapMarketData = ({
	series,
	yesProbability = 0,
	noProbability = 0,
	bestBid = undefined,
	bestAsk = undefined,
	status = 'Open',
	outcome = undefined
}: {
	series: RegistryDid.Series;
	yesProbability?: number;
	noProbability?: number;
	bestBid?: number;
	bestAsk?: number;
	status?: MarketStatus;
	outcome?: Outcome;
}): Market | undefined => {
	const {
		series_id: id,
		expiry_ns: expiryDate,
		creator,
		title,
		description: { plain: description },
		payout_unit: payoutUnit
	} = series;

	const token = assetToToken(payoutUnit);

	if (isNullish(token)) {
		return;
	}

	return {
		id: parseMarketId(id),
		title,
		description,
		creator: creator.toText(),
		expiryDate: expiryDate / NANO_SECONDS_IN_MILLISECOND,
		status,
		outcome,
		isInviteOnly: false,
		inviteList: [],
		totalVolume: ZERO,
		yesVolume: ZERO,
		noVolume: ZERO,
		yesProbability,
		noProbability,
		bestBid,
		bestAsk,
		token,
		pricePrecision: Number(series.price_precision)
	};
};

export const calculateProbability = ({
	bids,
	asks
}: {
	bids: OrderBookLevel[];
	asks: OrderBookLevel[];
}): { yesProbability: number; noProbability: number } => {
	if (bids.length === 0 && asks.length === 0) {
		return { yesProbability: 0.5, noProbability: 0.5 };
	}

	const sortedBids = bids.sort((a, b) => b.price - a.price);
	const sortedAsks = asks.sort((a, b) => a.price - b.price);

	if (bids.length > 0 && asks.length > 0) {
		const bestBid = sortedBids[0].price;
		const bestAsk = sortedAsks[0].price;
		const mid = (bestBid + bestAsk) / 2;
		return { yesProbability: mid, noProbability: 1 - mid };
	}

	if (bids.length > 0) {
		return { yesProbability: sortedBids[0].price, noProbability: 1 - sortedBids[0].price };
	}

	// asks.length > 0
	return { yesProbability: sortedAsks[0].price, noProbability: 1 - sortedAsks[0].price };
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
