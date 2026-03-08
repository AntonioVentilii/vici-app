import type { PrincipalText } from '@dfinity/zod-schemas';

export interface Comment {
	marketId: string;
	user: PrincipalText;
	content: string;
	timestamp: number;
	parentKey?: string; // For simple threading
}
