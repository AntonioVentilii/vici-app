import collections from '$root/juno.collections.json';

export const Collection = {
	ROLES: collections.ROLES,
	PROFILES: collections.PROFILES,
	RELATIONS: collections.RELATIONS,
	CHATS: collections.CHATS,
	COMMENTS: collections.COMMENTS,
	CATEGORIES: collections.CATEGORIES,
	SERIES_CATEGORIES: collections.SERIES_CATEGORIES,
	ACTIVITIES: collections.ACTIVITIES,
	/** Server-driven VXP new-user ladder state (owed vs paid); written from satellite hooks. */
	VXP_ONBOARDING: collections.VXP_ONBOARDING
} as const;

export type Collection = (typeof Collection)[keyof typeof Collection];
