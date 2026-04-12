import { RelationCategory, RelationState } from '$lib/enums/relation';
import { UserRole } from '$lib/enums/user';
import { j, PrincipalTextSchema } from '@junobuild/schema';

export const RelationCategorySchema = j.enum(RelationCategory);

export const RelationStateSchema = j.enum(RelationState);

export const RelationSchema = j.strictObject({
	category: RelationCategorySchema,
	state: RelationStateSchema,
	participants: j.array(PrincipalTextSchema),
	metadata: j.record(j.string(), j.any()).optional(),
	viewerPrincipal: PrincipalTextSchema.optional(),
	viewerRole: j.enum(UserRole).optional(),
	isFriend: j.boolean().optional(),
	createdAt: j.number(),
	updatedAt: j.number()
});

export const CheckFriendshipArgsSchema = j.strictObject({
	userA: PrincipalTextSchema,
	userB: PrincipalTextSchema
});
