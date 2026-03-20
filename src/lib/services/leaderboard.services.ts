import { Collection } from '$lib/constants/collections.constants';
import type { UserProfile } from '$lib/types/profile';
import { listDocs } from '@junobuild/core';

/**
 * Fetches and ranks users by their points (XP).
 * Points are probability-weighted and enhanced by streaks.
 */
export const getLeaderboard = async (limit = 100): Promise<UserProfile[]> => {
	const { items } = await listDocs<UserProfile>({
		collection: Collection.PROFILES
	});

	return items
		.map((doc) => ({
			...doc.data,
			owner: doc.key // Ensure owner is synced with doc key if not present
		}))
		.sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
		.slice(0, limit);
};
