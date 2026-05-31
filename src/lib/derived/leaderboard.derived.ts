import { cachedListOrEmpty, cachedNotInitialized } from '$lib/derived/cached.derived';
import { leaderboardStore } from '$lib/stores/leaderboard.store';
import { userStore } from '$lib/stores/user.store';
import type { UserProfile } from '$lib/types/profile';
import { derived, type Readable } from 'svelte/store';

/**
 * Cached leaderboard with the current user's row overlaid by their
 * locally-known profile. The leaderboard store is populated via
 * `listDocs` against the public profiles collection, so it reflects
 * whatever was last persisted — which may lag behind changes made in
 * this session, or still be the bootstrap shortened-principal fallback
 * if the user never edited their nickname. For the viewer's own row we
 * always have the freshest data in `userStore.profile`, so we splice
 * the live identity (nickname/avatar) **and** the live performance
 * fields (points/streak/accuracy) in here — the row, podium tile, and
 * mini-profile sheet all read from this single merged source so the
 * viewer sees their own up-to-the-second numbers rather than a stale
 * snapshot.
 */
export const leaderboard: Readable<UserProfile[]> = derived(
	[cachedListOrEmpty(leaderboardStore), userStore],
	([$leaderboard, { user, profile }]) => {
		if (!user || !profile) {
			return $leaderboard;
		}

		return $leaderboard.map((entry) =>
			entry.owner === user.owner
				? {
						...entry,
						nickname: profile.nickname,
						avatar: profile.avatar,
						points: profile.points,
						streak: profile.streak,
						accuracy: profile.accuracy
					}
				: entry
		);
	}
);

export const leaderboardNotInitialized: Readable<boolean> = cachedNotInitialized(leaderboardStore);
