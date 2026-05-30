import { cachedListOrEmpty, cachedNotInitialized } from '$lib/derived/cached.derived';
import { leaderboardStore } from '$lib/stores/leaderboard.store';
import { userStore } from '$lib/stores/user.store';
import type { UserProfile } from '$lib/types/profile';
import { derived, type Readable } from 'svelte/store';

/**
 * Cached leaderboard with the current user's row overlaid by their
 * locally-known profile (nickname + avatar). The leaderboard store is
 * populated via `listDocs` against the public profiles collection, so
 * it reflects whatever was last persisted — which may lag behind a
 * nickname/avatar change made in this session, or still be the
 * bootstrap shortened-principal fallback if the user never edited
 * their nickname. For the viewer's own row we always have the freshest
 * data in `userStore.profile`, so we splice it in here.
 */
export const leaderboard: Readable<UserProfile[]> = derived(
	[cachedListOrEmpty(leaderboardStore), userStore],
	([$leaderboard, { user, profile }]) => {
		if (!user || !profile) {
			return $leaderboard;
		}

		return $leaderboard.map((entry) =>
			entry.owner === user.owner
				? { ...entry, nickname: profile.nickname, avatar: profile.avatar }
				: entry
		);
	}
);

export const leaderboardNotInitialized: Readable<boolean> = cachedNotInitialized(leaderboardStore);
