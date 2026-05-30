import type { RegistryDid } from '$declarations';
import type { MarketTag } from '$lib/constants/market-tags.constants';
import { getFriendActivities } from '$lib/services/activity.services';
import { listMarketTagsBySeries } from '$lib/services/market-tags.services';
import { getFollowing } from '$lib/services/relation.services';
import { getUserTradeHistory } from '$lib/services/trade.services';
import type { UserMarketSignals } from '$lib/types/market-signals';
import { deriveUserMarketSignals } from '$lib/utils/market-signals.utils';

/**
 * `tagMappings` is an optional pre-fetched input: callers that
 * already hold tags from another fetch (e.g. `prepareFlow` shares
 * them with the queue ranking) can pass them in to avoid a
 * duplicate satellite round-trip.
 */
export const getUserMarketSignals = async ({
	domain,
	tagMappings
}: {
	domain: RegistryDid.BalanceDomain;
	tagMappings?: Record<string, MarketTag[]> | Promise<Record<string, MarketTag[]>>;
}): Promise<UserMarketSignals> => {
	const [events, resolvedTags, following] = await Promise.all([
		getUserTradeHistory(domain),
		tagMappings ?? listMarketTagsBySeries().catch(() => ({})),
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
		tagMappings: resolvedTags,
		friendActivities
	});
};
