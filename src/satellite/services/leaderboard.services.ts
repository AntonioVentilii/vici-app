import { Collection } from '$lib/constants/collections.constants';
import type { UserRole } from '$lib/enums/user';
import type { UserProfile } from '$lib/types/profile';
import { redactProfile } from '$satellite/services/privacy.services';
import { withProfileDefaults } from '$satellite/services/profile.services';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import { decodeDocData, getDocStore, listDocsStore } from '@junobuild/functions/sdk';

const LEADERBOARD_LIMIT = 50;

/**
 * Returns the top {@link LEADERBOARD_LIMIT} profiles ranked by points (XP),
 * matching what the frontend Leaderboard surface displays. Each row is
 * piped through {@link redactProfile} so visibility rules
 * (`FRIENDS_ONLY` / `FRIENDS_AND_FOLLOWERS`) are honoured — callers see
 * a `User <shortened>` placeholder instead of a private nickname when
 * they are not entitled to it.
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

	return items
		.map(([_, item]) => {
			const profile = decodeDocData<UserProfile>(item.data);

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
		.map((profile) => redactProfile({ caller, profile }));
};
