import type { RegistryDid } from '$declarations';
import { getFriendActivities } from '$lib/services/activity.services';
import { listSeriesCategories } from '$lib/services/category.services';
import { getFollowing } from '$lib/services/relation.services';
import { getUserTradeHistory } from '$lib/services/trade.services';
import type { UserMarketSignals } from '$lib/types/market-signals';
import { deriveUserMarketSignals } from '$lib/utils/market-signals.utils';

export const getUserMarketSignals = async (
	domain: RegistryDid.BalanceDomain
): Promise<UserMarketSignals> => {
	const [events, categoryMappings, following] = await Promise.all([
		getUserTradeHistory(domain),
		listSeriesCategories(),
		getFollowing().catch(() => [])
	]);

	const friendActivities =
		following.length > 0
			? await getFriendActivities({ friends: following, limit: 100, certified: false }).catch(
					() => []
				)
			: [];

	return deriveUserMarketSignals({
		events,
		categoryMappings,
		friendActivities
	});
};
