import type { Series } from '$declarations/registry/registry';
import { NANO_SECONDS_IN_MILLISECOND, ZERO } from '$lib/constants/app.constants';
import type { Market } from '$lib/types/market';
import { parseMarketId } from '$lib/validation/market.validation';

export const mapMarketData = ({
	series_id: id,
	expiry_ns: expiryDate,
	creator,
	title,
	description
}: Series): Market => ({
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
	noProbability: 0
});
