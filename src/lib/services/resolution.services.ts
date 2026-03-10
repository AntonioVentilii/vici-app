import type { ClearingDid } from '$declarations';
import { settleSeries as settleSeriesApi } from '$lib/api/clearing.api';
import { VICI_ORACLE_V1 } from '$lib/constants/app.constants';
import { logActivity } from '$lib/services/activity.services';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { getProfile } from '$lib/services/profile.services';
import { ActivityType } from '$lib/types/social';
import { UserRole } from '$lib/types/user';
import { nowInBigIntNanoSeconds, toNullable } from '@dfinity/utils';

export const settleMarket = async ({
	seriesId,
	settlementPrice
}: {
	seriesId: string;
	settlementPrice: bigint;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	// RBAC check: only ADMIN or RESOLVER can settle
	const profileDoc = await getProfile(identity.getPrincipal().toText());

	if (profileDoc.data.role !== UserRole.ADMIN && profileDoc.data.role !== UserRole.RESOLVER) {
		throw new Error('Unauthorized: only admins or resolvers can settle markets');
	}

	const params: ClearingDid.SettleSeriesParams = {
		series_id: seriesId,
		settlement_price: {
			decimal: {
				value: settlementPrice,
				decimals: 8
			},
			timestamp: toNullable(nowInBigIntNanoSeconds()),
			oracle_id: toNullable(VICI_ORACLE_V1)
		}
	};

	await settleSeriesApi({
		identity,
		params
	});

	await logActivity({
		type: ActivityType.SETTLEMENT,
		user: identity.getPrincipal().toText(),
		marketId: seriesId,
		title: `Market settled`,
		details: `Settled at ${settlementPrice}`
	});
};
