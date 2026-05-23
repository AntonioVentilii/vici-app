import collections from '$root/juno.collections.json';

export const Collection = {
	ROLES: collections.ROLES,
	PROFILES: collections.PROFILES,
	RELATIONS: collections.RELATIONS,
	CHATS: collections.CHATS,
	COMMENTS: collections.COMMENTS,
	MARKET_METADATA: collections.MARKET_METADATA,
	MARKET_TRANSLATIONS: collections.MARKET_TRANSLATIONS,
	ACTIVITIES: collections.ACTIVITIES,
	/**
	 * Server-driven VXP new-user ladder state (owed vs paid); written from satellite hooks.
	 */
	VXP_ONBOARDING: collections.VXP_ONBOARDING
} as const;

export type Collection = (typeof Collection)[keyof typeof Collection];
