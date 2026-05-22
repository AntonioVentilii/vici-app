import type { PrincipalText } from '@junobuild/schema';

export interface ChatMessage {
	marketId: string;
	sender: PrincipalText;
	content: string;
	timestamp: number;
}
