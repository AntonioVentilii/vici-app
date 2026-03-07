import type { RegistryDid } from '$declarations';
import { NANO_SECONDS_IN_MILLISECOND, ZERO } from '$lib/constants/app.constants';
import type { Market } from '$lib/types/market';
import { assetToToken } from '$lib/utils/asset.utils';
import { parseMarketId } from '$lib/validation/market.validation';
import { isNullish } from '@dfinity/utils';

export const mapMarketData = (series: RegistryDid.Series): Market | undefined => {
	const {
		series_id: id,
		expiry_ns: expiryDate,
		creator,
		title,
		description,
		settlement_asset: settlementAsset
	} = series;

	const token = assetToToken(settlementAsset);

	if (isNullish(token)) {
		return;
	}

	return {
		id: parseMarketId(id),
		title,
		description,
		creator: creator.toText(),
		expiryDate: expiryDate / NANO_SECONDS_IN_MILLISECOND,
		status: 'Open',
		outcome: undefined,
		isInviteOnly: false,
		inviteList: [],
		totalVolume: ZERO,
		yesVolume: ZERO,
		noVolume: ZERO,
		yesProbability: 0,
		noProbability: 0,
		token,
		pricePrecision: Number(series.price_precision)
	};
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
