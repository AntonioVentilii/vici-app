import { functions } from '$declarations/satellite/satellite.api';
import { ProfileVisibility } from '$lib/enums/profile';
import type { LeaderboardEntry } from '$lib/types/social';

/**
 * Top profiles by stored P&L as social leaderboard rows (rank, user, stats).
 */
export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
	const { items } = await functions.listLeaderboard();

	return items.map(({ owner: user, pnl, winRate, totalTrades, nickname, visibility }, index) => ({
		rank: index + 1,
		user,
		pnl,
		winRate,
		activePositions: totalTrades,
		nickname,
		visibility: (visibility as ProfileVisibility) ?? ProfileVisibility.FRIENDS_AND_FOLLOWERS
	}));
};
