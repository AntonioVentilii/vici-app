import type { PrincipalText } from '@junobuild/schema';

export interface Comment {
	key: string;
	marketId: string;
	user: PrincipalText;
	content: string;
	timestamp: number;
	parentKey?: string; // For simple threading
	upvotes: PrincipalText[];
	downvotes: PrincipalText[];
}
