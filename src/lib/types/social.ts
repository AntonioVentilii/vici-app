import type { ProfileVisibility } from '$lib/enums/profile';
import type { ActivityType } from '$lib/enums/social';
import type { Nickname } from '$lib/types/profile';
import type { PrincipalText } from '@junobuild/schema';

export interface LeaderboardEntry {
	rank: number;
	user: PrincipalText;
	pnl: number;
	winRate: number;
	activePositions: number;
	nickname: Nickname;
	visibility: ProfileVisibility;
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
