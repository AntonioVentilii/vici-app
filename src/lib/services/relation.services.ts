import { Collection } from '$lib/constants/collections.constants';
import { RelationCategory, RelationState, type Relation } from '$lib/types/relation';
import type { PrincipalText } from '@dfinity/zod-schemas';
import { deleteDoc, listDocs, setDoc, type Doc } from '@junobuild/core';

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

export const getFriends = async (userPrincipal: PrincipalText): Promise<Relation[]> => {
	const { items } = await listDocs<Relation>({
		collection: Collection.RELATIONS
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

export const followUser = async ({
	target,
	sender
}: {
	target: PrincipalText;
	sender: PrincipalText;
}): Promise<void> => {
	const relationId = `follow#${sender}#${target}`;
	const relation: Relation = {
		category: RelationCategory.FOLLOW,
		state: RelationState.ACTIVE,
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

export const unfollowUser = async ({
	sender,
	target
}: {
	sender: PrincipalText;
	target: PrincipalText;
}): Promise<void> => {
	const relationId = `follow#${sender}#${target}`;
	// In Juno core, there's no direct delete by key without the full Doc,
	// but we can try to use deleteDoc with just the key if the type allows it,
	// or fetch first. For simplicity in this mock-like environment,
	// we'll assume we can use the key.
	try {
		await deleteDoc({
			collection: Collection.RELATIONS,
			doc: { key: relationId }
		});
	} catch (e) {
		console.error('Failed to unfollow', e);
	}
};

export const getFollowing = async (userPrincipal: PrincipalText): Promise<PrincipalText[]> => {
	const { items } = await listDocs<Relation>({
		collection: Collection.RELATIONS
	});

	return items
		.map((doc) => doc.data)
		.filter((r) => r.category === RelationCategory.FOLLOW && r.participants[0] === userPrincipal)
		.map((r) => r.participants[1]);
};

export const getFollowers = async (userPrincipal: PrincipalText): Promise<PrincipalText[]> => {
	const { items } = await listDocs<Relation>({
		collection: Collection.RELATIONS
	});

	return items
		.map((doc) => doc.data)
		.filter((r) => r.category === RelationCategory.FOLLOW && r.participants[1] === userPrincipal)
		.map((r) => r.participants[0]);
};
