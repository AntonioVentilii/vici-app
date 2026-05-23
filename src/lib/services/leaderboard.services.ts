import { functions } from '$declarations/satellite/satellite.api';
import type { UserProfile } from '$lib/types/profile';
import { fromWireProfile } from '$satellite/utils/wire-format.utils';

/**
 * Fetches the top profiles ranked by points (XP) from the satellite-side
 * `listLeaderboard` query. Routing through the satellite (instead of a
 * direct `listDocs` against the profiles collection) is what makes
 * `redactProfile` apply: a viewer who isn't a friend / follower / admin
 * sees a `User <shortened>` placeholder for `FRIENDS_ONLY` and
 * `FRIENDS_AND_FOLLOWERS` rows, matching the visibility rules every other
 * social surface honours. The cap is enforced satellite-side
 * (`LEADERBOARD_LIMIT`).
 *
 * Points are probability-weighted and enhanced by streaks; the actual
 * sort happens satellite-side too so client and server agree on rank.
 */
export const getLeaderboard = async (): Promise<UserProfile[]> => {
	const { items } = await functions.listLeaderboard();

	return items.map(fromWireProfile);
};
