import type { RegistryDid } from '$declarations';
import { getFriendActivities } from '$lib/services/activity.services';
import { listMarketTagsBySeries } from '$lib/services/market-tags.services';
import { getFollowing } from '$lib/services/relation.services';
import { getUserTradeHistory } from '$lib/services/trade.services';
import type { UserMarketSignals } from '$lib/types/market-signals';
import { deriveUserMarketSignals } from '$lib/utils/market-signals.utils';

export const getUserMarketSignals = async (
	domain: RegistryDid.BalanceDomain
): Promise<UserMarketSignals> => {
	const [events, tagMappings, following] = await Promise.all([
		getUserTradeHistory(domain),
		listMarketTagsBySeries().catch(() => ({})),
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
		tagMappings,
		friendActivities
	});
};
