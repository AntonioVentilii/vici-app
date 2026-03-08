import type { LeaderboardEntry } from '$lib/types/social';

// eslint-disable-next-line require-await
export const getLeaderboard = async (): Promise<LeaderboardEntry[]> =>
	// Mock data for now as Juno doesn't store P&L/WinRate yet
	// This should eventually fetch from a derived collection or be calculated
	[
		{ rank: 1, user: 'CryptoKing', pnl: 4520.5, winRate: 88, activePositions: 12 },
		{ rank: 2, user: 'MoonWalker', pnl: 3100.2, winRate: 75, activePositions: 8 },
		{ rank: 3, user: 'ViciMaster', pnl: 2850.0, winRate: 92, activePositions: 5 },
		{ rank: 4, user: 'BullRider', pnl: 2100.3, winRate: 64, activePositions: 15 },
		{ rank: 5, user: 'PaperHands', pnl: 1850.7, winRate: 52, activePositions: 3 }
	];
