import { settleSeries as settleSeriesApi } from '$lib/api/clearing.api';
import { logActivity } from '$lib/services/activity.services';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { getProfile } from '$lib/services/profile.services';
import { ActivityType } from '$lib/types/social';
import { UserRole } from '$lib/types/user';

export const settleMarket = async ({
	seriesId,
	settlementPrice
}: {
	seriesId: string;
	settlementPrice: bigint;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	// RBAC check: only ADMIN or RESOLVER can settle
	const profile = await getProfile(identity.getPrincipal().toText());
	if (profile?.role !== UserRole.ADMIN && profile?.role !== UserRole.RESOLVER) {
		throw new Error('Unauthorized: only admins or resolvers can settle markets');
	}

	await settleSeriesApi({
		identity,
		params: {
			series_id: seriesId,
			settlement_price: settlementPrice
		}
	});

	await logActivity({
		type: ActivityType.SETTLEMENT,
		user: identity.getPrincipal().toText(),
		marketId: seriesId,
		title: `Market settled`,
		details: `Settled at ${settlementPrice}`
	});
};
