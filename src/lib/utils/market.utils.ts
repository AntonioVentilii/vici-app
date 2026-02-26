import type { Series } from '$declarations/registry/registry';
import { ZERO } from '$lib/constants/app.constants';
import type { Market } from '$lib/types/market';
import { parseMarketId } from '$lib/validation/market.validation';
import { Principal } from '@icp-sdk/core/principal';

export const mapMarketData = ({
	series_id: id,
	underlying: title,
	expiry: expiryDate
}: Series): Market => ({
	id: parseMarketId(id),
	title,
	description: '',
	creator: Principal.from('2vxsx-fae'),
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
