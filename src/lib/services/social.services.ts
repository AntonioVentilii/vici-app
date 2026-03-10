import { Collection } from '$lib/constants/collections.constants';
import type { UserProfile } from '$lib/types/profile';
import type { LeaderboardEntry } from '$lib/types/social';
import { listDocs } from '@junobuild/core';

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
	const { items } = await listDocs<UserProfile>({
		collection: Collection.PROFILES
	});

	return items
		.map((doc) => doc.data)
		.filter((p) => (p.totalTrades ?? 0) > 0) // Only show active traders
		.sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0))
		.map((p, index) => ({
			rank: index + 1,
			user: p.owner,
			pnl: p.pnl ?? 0,
			winRate: p.winRate ?? 0,
			activePositions: p.totalTrades ?? 0 // Using totalTrades as a proxy for activity
		}))
		.slice(0, 50); // Limit to top 50
};
