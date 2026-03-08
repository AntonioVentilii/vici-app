import { RelationCategory } from '$lib/types/relation';
import type { PrincipalText } from '@dfinity/zod-schemas';

export const toRelationId = ({
	sender,
	target
}: {
	sender: PrincipalText;
	target: PrincipalText;
}): string => `${RelationCategory.FOLLOW}#${sender}#${target}`;
