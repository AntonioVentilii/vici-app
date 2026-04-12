import type { PrincipalText } from '@junobuild/schema';

export interface ChatMessage {
	marketId: string;
	sender: PrincipalText;
	content: string;
	timestamp: number;
}

export interface Comment {
	marketId: string;
	userId: PrincipalText;
	content: string;
	parentId?: string; // For threaded comments
	timestamp: number;
	editedAt?: number;
}
