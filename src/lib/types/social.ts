import type { PrincipalText } from '@dfinity/zod-schemas';

export interface LeaderboardEntry {
	rank: number;
	user: PrincipalText;
	pnl: number;
	winRate: number;
	activePositions: number;
}
