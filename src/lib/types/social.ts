import type { PrincipalText } from '@dfinity/zod-schemas';

export interface LeaderboardEntry {
	rank: number;
	user: PrincipalText;
	pnl: number;
	winRate: number;
	activePositions: number;
}

export enum ActivityType {
	TRADE = 'trade',
	SETTLEMENT = 'settlement',
	COMMENT = 'comment',
	FOLLOW = 'follow'
}

export interface Activity {
	type: ActivityType;
	user: PrincipalText;
	targetUser?: PrincipalText;
	marketId?: string;
	title: string;
	details?: string;
	timestamp: number;
}
