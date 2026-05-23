import { functions } from '$declarations/satellite/satellite.api';
import { Collection } from '$lib/constants/collections.constants';
import type { Relation } from '$lib/types/relation';
import { toRelationId } from '$lib/utils/relation.utils';
import { isNullish } from '@dfinity/utils';
import { deleteDoc, getDoc, type Doc } from '@junobuild/core';
import type { PrincipalText } from '@junobuild/schema';

export const sendFriendRequest = async ({
	target
}: {
	target: PrincipalText;
	sender: PrincipalText;
}): Promise<void> => {
	await functions.sendFriendRequest({ target });
};

export const acceptFriendRequest = async ({
	currentRelation
}: {
	currentRelation: Doc<Relation> | { key: string };
}): Promise<void> => {
	await functions.acceptFriendRequest({ relationId: currentRelation.key });
};

export const rejectFriendRequest = async ({
	currentRelation
}: {
	currentRelation: Doc<Relation> | { key: string };
}): Promise<void> => {
	await functions.rejectFriendRequest({ relationId: currentRelation.key });
};

/**
 * Cancels a friend request previously sent by the caller. The satellite
 * enforces atomicity via a version-locked delete: if the recipient
 * accepts or rejects between the FE click and the canister write, the
 * cancel traps and the user gets an error — there is no race window
 * where both a cancel and an accept succeed.
 */
export const cancelFriendRequest = async ({
	currentRelation
}: {
	currentRelation: Doc<Relation> | { key: string };
}): Promise<void> => {
	await functions.cancelFriendRequest({ relationId: currentRelation.key });
};

/**
 * Removes a friend relation and rebalances group admins so groups don't end up
 * pointing at a no-longer-friend pair.
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
	} catch (e: unknown) {
		console.error('Failed to unfriend', e);
		throw e;
	}
};

export const getFriends = async (): Promise<Relation[]> => {
	const { items } = await functions.listFriends();

	return items as Relation[];
};

export const getFriendRequests = async (): Promise<Doc<Relation>[]> => {
	const { items } = await functions.listFriendRequests();

	return items.map((r) => {
		const relation = r as Relation;

		return {
			key: [...relation.participants].sort().join('#'),
			data: relation
		};
	});
};

export const getSentFriendRequests = async (): Promise<Doc<Relation>[]> => {
	const { items } = await functions.listSentFriendRequests();

	return items.map((r) => {
		const relation = r as Relation;

		return {
			key: [...relation.participants].sort().join('#'),
			data: relation
		};
	});
};

export const followUser = async ({
	target
}: {
	target: PrincipalText;
	sender: PrincipalText;
}): Promise<void> => {
	await functions.followUser({ target });
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

	if (isNullish(doc)) {
		throw new Error('Relation does not exist');
	}

	try {
		await deleteDoc({
			collection: Collection.RELATIONS,
			doc
		});
	} catch (e: unknown) {
		console.error('Failed to unfollow', e);
	}
};

export const getFollowing = async (): Promise<PrincipalText[]> => {
	const { items } = await functions.listFollowing();

	return items.map((r) => r.participants[1]);
};

export const getFollowers = async (): Promise<PrincipalText[]> => {
	const { items } = await functions.listFollowers();

	return items.map((r) => r.participants[0]);
};
