import { Collection } from '$lib/constants/collections.constants';
import { RelationCategory, RelationState, type Relation } from '$lib/types/relation';
import { toRelationId } from '$lib/utils/relation.utils';
import { isNullish } from '@dfinity/utils';
import type { PrincipalText } from '@dfinity/zod-schemas';
import { deleteDoc, getDoc, listDocs, setDoc, type Doc } from '@junobuild/core';

export const sendFriendRequest = async ({
	target,
	sender
}: {
	target: PrincipalText;
	sender: PrincipalText;
}): Promise<void> => {
	const relationId = [sender, target].sort().join('#');

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

	return items.reduce<Relation[]>((acc, { data }) => {
		if (
			data.category === RelationCategory.FRIEND &&
			data.state === RelationState.ACTIVE &&
			data.participants.includes(userPrincipal)
		) {
			acc.push(data);
		}

		return acc;
	}, []);
};

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

export const getFollowing = async (userPrincipal: PrincipalText): Promise<PrincipalText[]> => {
	const { items } = await listDocs<Relation>({
		collection: Collection.RELATIONS
	});

	return items.reduce<PrincipalText[]>((acc, { data }) => {
		if (data.category === RelationCategory.FOLLOW && data.participants[0] === userPrincipal) {
			acc.push(data.participants[1]);
		}

		return acc;
	}, []);
};

export const getFollowers = async (userPrincipal: PrincipalText): Promise<PrincipalText[]> => {
	const { items } = await listDocs<Relation>({
		collection: Collection.RELATIONS
	});

	return items.reduce<PrincipalText[]>((acc, { data }) => {
		if (data.category === RelationCategory.FOLLOW && data.participants[1] === userPrincipal) {
			acc.push(data.participants[0]);
		}

		return acc;
	}, []);
};
