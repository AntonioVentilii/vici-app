import { Collection } from '$lib/constants/collections.constants';
import { RelationCategory, RelationState, type Relation } from '$lib/types/relation';
import type { PrincipalText } from '@dfinity/zod-schemas';
import { listDocs, setDoc, type Doc } from '@junobuild/core';

export const sendFriendRequest = async ({
	target,
	sender
}: {
	target: PrincipalText;
	sender: PrincipalText;
}): Promise<void> => {
	const relationId = [sender, target].sort().join('#');
	const relation: Relation = {
		category: RelationCategory.FRIEND,
		state: RelationState.PENDING,
		participants: [sender, target],
		createdAt: Date.now(),
		updatedAt: Date.now()
	};

	await setDoc({
		collection: Collection.RELATIONS,
		doc: {
			key: relationId,
			data: relation
		}
	});
};

export const acceptFriendRequest = async ({
	relationId,
	currentRelation
}: {
	relationId: string;
	currentRelation: Doc<Relation>;
}): Promise<void> => {
	await setDoc({
		collection: Collection.RELATIONS,
		doc: {
			...currentRelation,
			data: {
				...currentRelation.data,
				state: RelationState.ACTIVE,
				updatedAt: Date.now()
			}
		}
	});
};

export const getFriends = async (userPrincipal: PrincipalText): Promise<Relation[]> => {
	const { items } = await listDocs<Relation>({
		collection: Collection.RELATIONS,
		filter: {
			matcher: {
				description: 'Find relations where user is a participant'
				// Juno filters are limited in complex queries,
				// usually we filter client side or use specific key patterns
			}
		}
	});

	return items
		.map((doc) => doc.data)
		.filter(
			(r) =>
				r.category === RelationCategory.FRIEND &&
				r.state === RelationState.ACTIVE &&
				r.participants.includes(userPrincipal)
		);
};
