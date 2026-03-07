import type { Series } from '$declarations/registry/registry';
import { NANO_SECONDS_IN_MILLISECOND, ZERO } from '$lib/constants/app.constants';
import type { Market } from '$lib/types/market';
import { assetToToken } from '$lib/utils/asset.utils';
import { parseMarketId } from '$lib/validation/market.validation';
import { isNullish } from '@dfinity/utils';

export const mapMarketData = (series: Series): Market | undefined => {
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
