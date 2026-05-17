import { RelationCategory } from '$lib/enums/relation';
import type { PrincipalText } from '@junobuild/schema';

export const toRelationId = ({
	sender,
	target
}: {
	sender: PrincipalText;
	target: PrincipalText;
}): string => `${RelationCategory.FOLLOW}#${sender}#${target}`;
