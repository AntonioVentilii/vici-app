import { Collection } from '$lib/constants/collections.constants';
import type { UserRole } from '$lib/enums/user';
import type { UserProfile } from '$lib/types/profile';
import { isPubliclyHidden, withProfileDefaults } from '$satellite/services/profile.services';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import { decodeDocData, getDocStore, listDocsStore } from '@junobuild/functions/sdk';

const LEADERBOARD_LIMIT = 50;

/**
 * Returns the top {@link LEADERBOARD_LIMIT} profiles ranked by points (XP),
 * matching what the frontend Leaderboard surface displays.
 *
 * Nicknames/handles are returned for every profile the caller can see —
 * the broader "who can see whom" gate (visibility rework) is owned by a
 * future change and is out of scope here.
 *
 * The shape mirrors {@link UserProfile} (no extra wrapping) so the
 * frontend can render it through the same components used everywhere
 * else.
 */
export const listLeaderboard = (): UserProfile[] => {
	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.PROFILES,
		caller,
		params: {}
	});

	return (
		items
			.map(([_, item]) => decodeDocData<UserProfile>(item.data))
			// Soft-deleted OR hibernated accounts (Delete account v2) drop
			// off the public leaderboard before the role lookup + hydrate.
			.filter((profile) => !isPubliclyHidden(profile))
			.map((profile) => {
				const roleDoc = getDocStore({
					collection: Collection.ROLES,
					key: profile.owner,
					caller
				});

				return withProfileDefaults({
					...profile,
					role: roleDoc ? decodeDocData<{ role: UserRole }>(roleDoc.data).role : undefined
				});
			})
			.sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
			.slice(0, LEADERBOARD_LIMIT)
	);
};
