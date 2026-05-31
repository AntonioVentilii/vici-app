import { Collection } from '$lib/constants/collections.constants';
import type { UserRole } from '$lib/enums/user';
import type { UserProfile } from '$lib/types/profile';
import { isPubliclyHidden, withProfileDefaults } from '$satellite/services/profile.services';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import { decodeDocData, getDocStore, listDocsStore } from '@junobuild/functions/sdk';
import type { PrincipalText } from '@junobuild/schema';

const LEADERBOARD_LIMIT = 50;

/**
 * Every non-hidden profile, sorted by `points` (XP) descending — the
 * SAME filter + sort key the public {@link listLeaderboard} uses, just
 * without the top-{@link LEADERBOARD_LIMIT} slice. The single source of
 * truth for the global ranking so {@link countNonHiddenProfilesFn} and
 * {@link getUserRankFn} agree byte-for-byte with the visible leaderboard.
 *
 * Ties on `points` are broken by `owner` ascending so a principal's rank
 * is stable across reads (without it, two equal-points rows could swap
 * order between calls and flip a user in/out of the top decile).
 */
const rankedProfiles = (): UserProfile[] => {
	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.PROFILES,
		caller,
		params: {}
	});

	return items
		.map(([_, item]) => decodeDocData<UserProfile>(item.data))
		.filter((profile) => !isPubliclyHidden(profile))
		.sort((a, b) => {
			const delta = (b.points ?? 0) - (a.points ?? 0);

			if (delta !== 0) {
				return delta;
			}

			return a.owner < b.owner ? -1 : a.owner > b.owner ? 1 : 0;
		});
};

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

/**
 * Count of profiles that appear on the public leaderboard (non-hidden).
 * The denominator for the `top-decile` achievement: a user is in the top
 * 10% when their {@link getUserRankFn} rank is ≤ `count / 10`.
 */
export const countNonHiddenProfilesFn = (): number => rankedProfiles().length;

/**
 * 1-based rank of `principal` within the global leaderboard ordering
 * ({@link rankedProfiles}). Returns `undefined` when the principal has no
 * profile or is hidden (soft-deleted / hibernated) — callers treat that as
 * "unranked".
 */
export const getUserRankFn = ({ principal }: { principal: PrincipalText }): number | undefined => {
	const index = rankedProfiles().findIndex((profile) => profile.owner === principal);

	if (index === -1) {
		return;
	}

	return index + 1;
};
