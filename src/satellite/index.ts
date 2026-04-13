import { Collection } from '$lib/constants/collections.constants';
import { UserProfileSchema } from '$lib/schema/profile.schema';
import { CheckFriendshipArgsSchema, RelationSchema } from '$lib/schema/relation.schema';
import { listLeaderboard as listLeaderboardFn } from '$satellite/services/leaderboard.services';
import {
	assertUniqueNickname,
	getProfile as getProfileFn,
	searchProfiles as searchProfilesFn
} from '$satellite/services/profile.services';
import {
	acceptFriendRequest as acceptFriendRequestFn,
	checkFriendship as checkFriendshipFn,
	followUser as followUserFn,
	listFollowers as listFollowersFn,
	listFollowing as listFollowingFn,
	listFriendRequests as listFriendRequestsFn,
	listFriends as listFriendsFn,
	listRejectedFriendships as listRejectedFriendshipsFn,
	rejectFriendRequest as rejectFriendRequestFn,
	sendFriendRequest as sendFriendRequestFn
} from '$satellite/services/relation.services';
import { assertSetRole } from '$satellite/services/roles.services';
import {
	onProfileSetForVxpOnboarding,
	onTradeActivityForVxpOnboarding
} from '$satellite/services/vxp-onboarding.services';
import {
	defineAssert,
	defineHook,
	defineQuery,
	defineUpdate,
	type AssertSetDoc,
	type AssertSetDocContext,
	type OnSetDoc,
	type OnSetDocContext,
	type RunFunction
} from '@junobuild/functions';
import { j, PrincipalTextSchema } from '@junobuild/schema';

// --- Queries ---

export const listLeaderboard = defineQuery({
	result: j.strictObject({
		items: j.array(UserProfileSchema)
	}),
	handler: () => ({
		items: listLeaderboardFn()
	})
});

export const getProfile = defineQuery({
	args: j.strictObject({
		principal_str: PrincipalTextSchema
	}),
	result: j.strictObject({
		profile: j.optional(UserProfileSchema)
	}),
	handler: ({ principal_str }) => ({
		profile: getProfileFn(principal_str)
	})
});

export const searchProfiles = defineQuery({
	args: j.strictObject({
		query_str: j.string()
	}),
	result: j.strictObject({
		items: j.array(UserProfileSchema)
	}),
	handler: ({ query_str }) => ({
		items: searchProfilesFn(query_str)
	})
});

export const listFriends = defineQuery({
	result: j.strictObject({
		items: j.array(RelationSchema)
	}),
	handler: () => ({ items: listFriendsFn() })
});

export const listFollowers = defineQuery({
	result: j.strictObject({
		items: j.array(RelationSchema)
	}),
	handler: () => ({ items: listFollowersFn() })
});

export const listFollowing = defineQuery({
	result: j.strictObject({
		items: j.array(RelationSchema)
	}),
	handler: () => ({ items: listFollowingFn() })
});

export const checkFriendship = defineQuery({
	args: CheckFriendshipArgsSchema,
	result: j.strictObject({
		isFriend: j.boolean()
	}),
	handler: (args) => ({ isFriend: checkFriendshipFn(args) })
});

export const listFriendRequests = defineQuery({
	result: j.strictObject({
		items: j.array(RelationSchema)
	}),
	handler: () => ({
		items: listFriendRequestsFn()
	})
});

export const listRejectedFriendships = defineQuery({
	result: j.strictObject({
		items: j.array(RelationSchema)
	}),
	handler: () => ({
		items: listRejectedFriendshipsFn()
	})
});

// --- Updates ---

export const sendFriendRequest = defineUpdate({
	args: j.strictObject({
		target: PrincipalTextSchema
	}),
	handler: sendFriendRequestFn
});

export const acceptFriendRequest = defineUpdate({
	args: j.strictObject({
		relation_id: j.string()
	}),
	handler: acceptFriendRequestFn
});

export const rejectFriendRequest = defineUpdate({
	args: j.strictObject({
		relation_id: j.string()
	}),
	handler: rejectFriendRequestFn
});

export const followUser = defineUpdate({
	args: j.strictObject({
		target: PrincipalTextSchema
	}),
	handler: followUserFn
});

// --- Assertions ---

const assertSetDocCollections = [Collection.PROFILES, Collection.ROLES] as const;

type AssertSetDocCollection = (typeof assertSetDocCollections)[number];

export const assertSetDoc = defineAssert<AssertSetDoc>({
	collections: assertSetDocCollections,
	assert: (context) => {
		const fn: Record<AssertSetDocCollection, (ctx: AssertSetDocContext) => void> = {
			[Collection.PROFILES]: assertUniqueNickname,
			[Collection.ROLES]: assertSetRole
		};

		fn[context.data.collection]?.(context);
	}
});

// --- Hooks ---

const setDocCollections = [Collection.ACTIVITIES, Collection.PROFILES] as const;

type OnSetDocCollection = (typeof setDocCollections)[number];

export const onSetDoc = defineHook<OnSetDoc>({
	collections: setDocCollections,
	run: async (context) => {
		const fn: Record<OnSetDocCollection, RunFunction<OnSetDocContext>> = {
			[Collection.PROFILES]: onProfileSetForVxpOnboarding,
			[Collection.ACTIVITIES]: onTradeActivityForVxpOnboarding
		};

		await fn[context.data.collection]?.(context);
	}
});
