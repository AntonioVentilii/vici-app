import { functions } from '$declarations/satellite/satellite.api';
import { ProfileVisibility } from '$lib/enums/profile';
import type { Nickname } from '$lib/types/profile';
import type { LeaderboardEntry } from '$lib/types/social';

/**
 * Top profiles by stored P&L as social leaderboard rows (rank, user, stats).
 */
export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
	const { items } = (await functions.listLeaderboard()) as {
		items: Record<string, unknown>[];
	};

	return items.map((p, index: number) => ({
		rank: index + 1,
		user: typeof p.owner === 'string' ? p.owner : (p.owner as { toText: () => string }).toText(),
		pnl: (p.pnl as number) ?? 0,
		winRate: (p.winRate as number) ?? 0,
		activePositions: (p.totalTrades as number) ?? 0,
		nickname: (p.nickname as Nickname) ?? undefined,
		visibility: (p.visibility as ProfileVisibility) ?? ProfileVisibility.FRIENDS_ONLY
	}));
};
