import { Collection } from '$lib/constants/collections.constants';
import { RelationCategory, RelationState, type Relation } from '$lib/types/relation';
import { toRelationId } from '$lib/utils/relation.utils';
import { isNullish } from '@dfinity/utils';
import type { PrincipalText } from '@dfinity/zod-schemas';
import { deleteDoc, getDoc, listDocs, setDoc, type Doc } from '@junobuild/core';

/** Creates a pending friend relation between sender and target. */
export const sendFriendRequest = async ({
	target,
	sender
}: {
	target: PrincipalText;
	sender: PrincipalText;
}): Promise<void> => {
	const relationId = [sender, target].sort().join('#');

	const existingDoc = await getDoc<Relation>({
		collection: Collection.RELATIONS,
		key: relationId
	});

	if (existingDoc !== undefined) {
		throw new Error(`Friend request already exists with state: ${existingDoc.data.state}`);
	}

	const now = Date.now();

	const relation: Relation = {
		category: RelationCategory.FRIEND,
		state: RelationState.PENDING,
		participants: [sender, target],
		createdAt: now,
		updatedAt: now
	};

	await setDoc({
		collection: Collection.RELATIONS,
		doc: {
			key: relationId,
			data: relation
		}
	});
};

/** Marks a friend relation as active. */
export const acceptFriendRequest = async ({
	currentRelation
}: {
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

/** Marks a friend relation as rejected. */
export const rejectFriendRequest = async ({
	currentRelation
}: {
	currentRelation: Doc<Relation>;
}): Promise<void> => {
	await setDoc({
		collection: Collection.RELATIONS,
		doc: {
			...currentRelation,
			data: {
				...currentRelation.data,
				state: RelationState.REJECTED,
				updatedAt: Date.now()
			}
		}
	});
};

/** Removes a friend relation and syncs group admins. */
export const unfriendUser = async (params: {
	sender: PrincipalText;
	target: PrincipalText;
}): Promise<void> => {
	const relationId = [params.sender, params.target].sort().join('#');

	const doc = await getDoc<Relation>({
		collection: Collection.RELATIONS,
		key: relationId
	});

	if (isNullish(doc)) {
		throw new Error('Relation does not exist');
	}

	try {
		// We delete the relation so it is clear and they can retry later
		await deleteDoc({
			collection: Collection.RELATIONS,
			doc
		});

		// Sync group admins dynamically to avoid circular dependency
		const { syncGroupAdminsAfterUnfriend } = await import('$lib/services/group.services');
		await syncGroupAdminsAfterUnfriend({ userA: params.sender, userB: params.target });
	} catch (e) {
		console.error('Failed to unfriend', e);
		throw e;
	}
};

/** Active friend relations that include the user. */
export const getFriends = async (userPrincipal: PrincipalText): Promise<Relation[]> => {
	const { items } = await listDocs<Relation>({
		collection: Collection.RELATIONS
	});

	return items
		.map(({ data }) => data)
		.filter(
			(data) =>
				data.category === RelationCategory.FRIEND &&
				data.state === RelationState.ACTIVE &&
				data.participants.includes(userPrincipal)
		)
		.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
};

/** Pending incoming friend requests for the user. */
export const getFriendRequests = async (userPrincipal: PrincipalText): Promise<Doc<Relation>[]> => {
	const { items } = await listDocs<Relation>({
		collection: Collection.RELATIONS
	});

	return items
		.filter(
			({ data }) =>
				data.category === RelationCategory.FRIEND &&
				data.state === RelationState.PENDING &&
				data.participants[1] === userPrincipal // User is the target
		)
		.sort((a, b) => (b.data.createdAt ?? 0) - (a.data.createdAt ?? 0));
};

/** Friendships that the user explicitly rejected or was involved in rejecting. */
export const getRejectedFriendships = async (
	userPrincipal: PrincipalText
): Promise<Doc<Relation>[]> => {
	const { items } = await listDocs<Relation>({
		collection: Collection.RELATIONS
	});

	return items
		.filter(
			({ data }) =>
				data.category === RelationCategory.FRIEND &&
				data.state === RelationState.REJECTED &&
				data.participants.includes(userPrincipal)
		)
		.sort((a, b) => (b.data.createdAt ?? 0) - (a.data.createdAt ?? 0));
};

/** Creates or overwrites an active follow from sender to target. */
export const followUser = async ({
	target,
	sender
}: {
	target: PrincipalText;
	sender: PrincipalText;
}): Promise<void> => {
	const relationId = toRelationId({ sender, target });

	const now = Date.now();

	const relation: Relation = {
		category: RelationCategory.FOLLOW,
		state: RelationState.ACTIVE,
		participants: [sender, target],
		createdAt: now,
		updatedAt: now
	};

	await setDoc({
		collection: Collection.RELATIONS,
		doc: {
			key: relationId,
			data: relation
		}
	});
};

/** Deletes the follow relation document for sender→target. */
export const unfollowUser = async (params: {
	sender: PrincipalText;
	target: PrincipalText;
}): Promise<void> => {
	const relationId = toRelationId(params);

	const doc = await getDoc<Relation>({
		collection: Collection.RELATIONS,
		key: relationId
	});

	// This should never happen since we only show the unfollow button for existing relations, but we check just in case
	if (isNullish(doc)) {
		throw new Error('Relation does not exist');
	}

	try {
		await deleteDoc({
			collection: Collection.RELATIONS,
			doc
		});
	} catch (e) {
		console.error('Failed to unfollow', e);
	}
};

/** Loads all relation documents (internal helper). */
const listRelations = async (): Promise<Relation[]> => {
	const { items } = await listDocs<Relation>({
		collection: Collection.RELATIONS
	});

	return items.map(({ data }) => data);
};

/** Principals the user follows (follow relation participant order: follower first). */
export const getFollowing = async (userPrincipal: PrincipalText): Promise<PrincipalText[]> => {
	// Relations for following are stored in the same collection.
	// We use matcher to filter for relations involving the user principal.
	const items = await listRelations();

	return items
		.filter(
			(data) => data.category === RelationCategory.FOLLOW && data.participants[0] === userPrincipal
		)
		.map((r) => r.participants[1]);
};

/** Principals following the user. */
export const getFollowers = async (userPrincipal: PrincipalText): Promise<PrincipalText[]> => {
	const items = await listRelations();

	return items
		.filter(
			(data) => data.category === RelationCategory.FOLLOW && data.participants[1] === userPrincipal
		)
		.map((r) => r.participants[0]);
};
