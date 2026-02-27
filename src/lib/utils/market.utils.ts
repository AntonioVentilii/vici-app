import type { Series } from '$declarations/registry/registry';
import { ZERO } from '$lib/constants/app.constants';
import type { Market } from '$lib/types/market';
import { parseMarketId } from '$lib/validation/market.validation';

export const mapMarketData = ({
	series_id: id,
	expiry: expiryDate,
	creator,
	title,
	description
}: Series): Market => ({
	id: parseMarketId(id),
	title,
	description,
	creator,
	expiryDate,
	status: 'Open',
	outcome: undefined,
	isInviteOnly: false,
	inviteList: [],
	totalVolume: ZERO,
	yesVolume: ZERO,
	noVolume: ZERO,
	yesProbability: 0,
	noProbability: 0
});
