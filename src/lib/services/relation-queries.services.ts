import { functions } from '$declarations/satellite/satellite.api';
import type { Relation } from '$lib/types/relation';
import type { ResolvedResult } from '$lib/types/social';
import type { Doc } from '@junobuild/core';
import type { PrincipalText } from '@junobuild/schema';

/**
 * Read-only relation queries (friends, friend requests, follows). Split out
 * from the relation *mutation* layer (`relation.services`) so consumers that
 * only need to read the social graph — notably `group.services` — depend on
 * these without pulling in the mutation layer, which in turn depends on
 * `group.services`. Keeping the reads here breaks that import cycle without
 * any runtime `import()`. These are thin satellite passthroughs.
 */

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

/**
 * Friend-scoped resolved-result rows backing the Arena results digest's standout
 * line. One bounded satellite read over the supplied friend set's
 * `resolved_results` rows (`${owner}#${marketId}`) within the active retention
 * window — never one call per friend. Returns an empty list for an empty set so
 * the digest can render its aggregate (W–L / net VXP) without a standout.
 */
export const getFriendResolvedResults = async ({
	friends
}: {
	friends: PrincipalText[];
}): Promise<ResolvedResult[]> => {
	if (friends.length === 0) {
		return [];
	}

	const { items } = await functions.listFriendResolvedResults({ friends });

	return items;
};

export const getFollowing = async (): Promise<PrincipalText[]> => {
	const { items } = await functions.listFollowing();

	return items.map((r) => r.participants[1]);
};

export const getFollowers = async (): Promise<PrincipalText[]> => {
	const { items } = await functions.listFollowers();

	return items.map((r) => r.participants[0]);
};
