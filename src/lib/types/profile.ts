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
}
