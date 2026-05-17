import { Collection } from '$lib/constants/collections.constants';
import { UserProfileSchema } from '$lib/schema/profile.schema';
import { CheckFriendshipArgsSchema, RelationSchema } from '$lib/schema/relation.schema';
import {
	syncRoleToEngineOnDelete,
	syncRoleToEngineOnSet
} from '$satellite/services/engine-sync.services';
import { listLeaderboard as listLeaderboardFn } from '$satellite/services/leaderboard.services';
import {
	assertValidNickname,
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
	type OnDeleteDoc,
	type OnDeleteDocContext,
	type OnSetDoc,
	type OnSetDocContext,
	type RunFunction
} from '@junobuild/functions';
import { j, PrincipalTextSchema } from '@junobuild/schema';

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
		// `principal` collides with @junobuild/schema's reserved name; rename on the wire.
		principalStr: PrincipalTextSchema
	}),
	result: j.strictObject({
		profile: j.optional(UserProfileSchema)
	}),
	handler: ({ principalStr }) => ({
		profile: getProfileFn(principalStr)
	})
});

export const searchProfiles = defineQuery({
	args: j.strictObject({
		// `query` collides with @junobuild/schema's reserved name; rename on the wire.
		queryStr: j.string()
	}),
	result: j.strictObject({
		items: j.array(UserProfileSchema)
	}),
	handler: ({ queryStr }) => ({
		items: searchProfilesFn(queryStr)
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

export const sendFriendRequest = defineUpdate({
	args: j.strictObject({
		target: PrincipalTextSchema
	}),
	handler: sendFriendRequestFn
});

export const acceptFriendRequest = defineUpdate({
	args: j.strictObject({
		relationId: j.string()
	}),
	handler: acceptFriendRequestFn
});

export const rejectFriendRequest = defineUpdate({
	args: j.strictObject({
		relationId: j.string()
	}),
	handler: rejectFriendRequestFn
});

export const followUser = defineUpdate({
	args: j.strictObject({
		target: PrincipalTextSchema
	}),
	handler: followUserFn
});

const assertSetDocCollections = [Collection.PROFILES, Collection.ROLES] as const;

type AssertSetDocCollection = (typeof assertSetDocCollections)[number];

export const assertSetDoc = defineAssert<AssertSetDoc>({
	collections: assertSetDocCollections,
	assert: (context) => {
		const fn: Record<AssertSetDocCollection, (ctx: AssertSetDocContext) => void> = {
			[Collection.PROFILES]: assertValidNickname,
			[Collection.ROLES]: assertSetRole
		};

		fn[context.data.collection]?.(context);
	}
});

const setDocCollections = [Collection.ACTIVITIES, Collection.PROFILES, Collection.ROLES] as const;

type OnSetDocCollection = (typeof setDocCollections)[number];

export const onSetDoc = defineHook<OnSetDoc>({
	collections: setDocCollections,
	run: async (context) => {
		const fn: Record<OnSetDocCollection, RunFunction<OnSetDocContext>> = {
			[Collection.PROFILES]: onProfileSetForVxpOnboarding,
			[Collection.ACTIVITIES]: onTradeActivityForVxpOnboarding,
			[Collection.ROLES]: syncRoleToEngineOnSet
		};

		await fn[context.data.collection]?.(context);
	}
});

const deleteDocCollections = [Collection.ROLES] as const;

type OnDeleteDocCollection = (typeof deleteDocCollections)[number];

export const onDeleteDoc = defineHook<OnDeleteDoc>({
	collections: deleteDocCollections,
	run: async (context) => {
		const fn: Record<OnDeleteDocCollection, RunFunction<OnDeleteDocContext>> = {
			[Collection.ROLES]: syncRoleToEngineOnDelete
		};

		await fn[context.data.collection]?.(context);
	}
});
