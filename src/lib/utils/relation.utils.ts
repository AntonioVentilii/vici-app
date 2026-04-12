import { RelationCategory } from '$lib/enums/relation';
import type { PrincipalText } from '@junobuild/schema';

/**
 * Builds a stable document key for a follow relation between two principals.
 */
export const toRelationId = ({
	sender,
	target
}: {
	sender: PrincipalText;
	target: PrincipalText;
}): string => `${RelationCategory.FOLLOW}#${sender}#${target}`;
