import { RelationCategory } from '$lib/types/relation';
import type { PrincipalText } from '@dfinity/zod-schemas';

/** Builds a stable document key for a follow relation between two principals. */
export const toRelationId = ({
	sender,
	target
}: {
	sender: PrincipalText;
	target: PrincipalText;
}): string => `${RelationCategory.FOLLOW}#${sender}#${target}`;
