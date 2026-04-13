import { functions } from '$declarations/satellite/satellite.api';
import { Collection } from '$lib/constants/collections.constants';
import type { Relation } from '$lib/types/relation';
import { toRelationId } from '$lib/utils/relation.utils';
import { isNullish } from '@dfinity/utils';
import { deleteDoc, getDoc, type Doc } from '@junobuild/core';
import type { PrincipalText } from '@junobuild/schema';

/**
 * Creates a pending friend relation between sender and target.
 */
export const sendFriendRequest = async ({
	target
}: {
	target: PrincipalText;
	sender: PrincipalText;
}): Promise<void> => {
	await functions.sendFriendRequest({ target });
};

/**
 * Marks a friend relation as active.
 */
export const acceptFriendRequest = async ({
	currentRelation
}: {
	currentRelation: Doc<Relation> | { key: string };
}): Promise<void> => {
	await functions.acceptFriendRequest({ relationId: currentRelation.key });
};

/**
 * Marks a friend relation as rejected.
 */
export const rejectFriendRequest = async ({
	currentRelation
}: {
	currentRelation: Doc<Relation> | { key: string };
}): Promise<void> => {
	await functions.rejectFriendRequest({ relationId: currentRelation.key });
};

/**
 * Removes a friend relation and syncs group admins.
 */
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
		await deleteDoc({
			collection: Collection.RELATIONS,
			doc
		});

		const { syncGroupAdminsAfterUnfriend } = await import('$lib/services/group.services');
		await syncGroupAdminsAfterUnfriend({ userA: params.sender, userB: params.target });
	} catch (e) {
		console.error('Failed to unfriend', e);
		throw e;
	}
};

/**
 * Active friend relations that include the user.
 */
export const getFriends = async (): Promise<Relation[]> => {
	const { items } = await functions.listFriends();

	return items as Relation[];
};

/**
 * Pending incoming friend requests for the user.
 */
export const getFriendRequests = async (): Promise<Doc<Relation>[]> => {
	const { items } = await functions.listFriendRequests();

	return items.map((r, i) => ({
		key: `request-${i}`,
		data: r as Relation
	}));
};

/**
 * Friendships that the user explicitly rejected or was involved in rejecting.
 */
export const getRejectedFriendships = async (): Promise<Doc<Relation>[]> => {
	const { items } = await functions.listRejectedFriendships();

	return items.map((r, i) => ({
		key: `rejected-${i}`,
		data: r as Relation
	}));
};

/**
 * Creates or overwrites an active follow from sender to target.
 */
export const followUser = async ({
	target
}: {
	target: PrincipalText;
	sender: PrincipalText;
}): Promise<void> => {
	await functions.followUser({ target });
};

/**
 * Deletes the follow relation document for sender->target.
 */
export const unfollowUser = async (params: {
	sender: PrincipalText;
	target: PrincipalText;
}): Promise<void> => {
	const relationId = toRelationId(params);

	const doc = await getDoc<Relation>({
		collection: Collection.RELATIONS,
		key: relationId
	});

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

/**
 * Principals the user follows.
 */
export const getFollowing = async (): Promise<PrincipalText[]> => {
	const { items } = await functions.listFollowing();

	return items.map((r) => r.participants[1]);
};

/**
 * Principals following the user.
 */
export const getFollowers = async (): Promise<PrincipalText[]> => {
	const { items } = await functions.listFollowers();

	return items.map((r) => r.participants[0]);
};
