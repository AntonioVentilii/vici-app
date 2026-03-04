import type { PrincipalText } from '@dfinity/zod-schemas';

export enum RelationCategory {
	FRIEND = 'FRIEND',
	GROUP = 'GROUP'
}

export enum RelationState {
	PENDING = 'PENDING',
	ACTIVE = 'ACTIVE',
	REJECTED = 'REJECTED',
	BLOCKED = 'BLOCKED'
}

export interface Relation {
	category: RelationCategory;
	state: RelationState;
	participants: PrincipalText[];
	metadata?: Record<string, any>;
	createdAt: number;
	updatedAt: number;
}
