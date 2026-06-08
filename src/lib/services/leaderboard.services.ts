import { functions } from '$declarations/satellite/satellite.api';
import type { UserProfile } from '$lib/types/profile';
import { fromWireProfile } from '$satellite/utils/wire-format.utils';

/**
 * Fetches the top profiles ranked by points (XP) from the satellite-side
 * `listLeaderboard` query. Routing through the satellite (instead of a
 * direct `listDocs` against the profiles collection) keeps the cap
 * (`LEADERBOARD_LIMIT`) and the ranking authoritative server-side.
 *
 * Nicknames are returned as-is for every row the caller is allowed to
 * see; the broader "who can see whom" gate is owned by the upcoming
 * user-visibility rework.
 *
 * Points are probability-weighted and enhanced by streaks; the actual
 * sort happens satellite-side too so client and server agree on rank.
 */
export const getLeaderboard = async (): Promise<UserProfile[]> => {
	const { items } = await functions.listLeaderboard();

	return items.map(fromWireProfile);
};

/**
 * The caller's rival — the profile ranked one place above them across the
 * full points ranking (not just the top-{@link getLeaderboard} slice), so
 * the "Your rival" insight resolves for every ranked user. `undefined`
 * when the caller is unranked or already rank 1.
 *
 * The satellite returns the profile in camelCase (`j.optional(Record)`),
 * so no wire decode is needed — it's the same shape as `getProfile`.
 */
export const getMyRival = async (): Promise<UserProfile | undefined> => {
	const { rival } = await functions.getMyRival();

	return rival as UserProfile | undefined;
};
