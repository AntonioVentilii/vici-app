import type { UserRole } from '$lib/types/user';
import type { PrincipalText } from '@dfinity/zod-schemas';

export interface UserProfile {
	owner: PrincipalText;
	nickname: string;
	avatar?: string;
	bio?: string;
	role?: UserRole;
	createdAt: number;
	updatedAt: number;
	totalTrades?: number;
	winRate?: number;
	pnl?: number;
	interests?: string[];
	streak?: number;
	accuracy?: number;
	points?: number;
	level?: number;
	rank?: number;
	dailyStreak?: number;
	lastActiveDay?: string;
	preferences?: {
		defaultAmount?: {
			flow?: string;
			manual?: string;
		};
	};
}
