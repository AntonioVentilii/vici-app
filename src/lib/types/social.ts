import type { ActivityType } from '$lib/enums/social';
import type { PrincipalText } from '@junobuild/schema';

export interface Activity {
	type: ActivityType;
	user: PrincipalText;
	targetUser?: PrincipalText;
	marketId?: string;
	title: string;
	details?: string;
	timestamp: number;
}
