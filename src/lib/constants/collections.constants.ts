export enum Collection {
	ROLES = 'roles',
	PROFILES = 'profiles',
	RELATIONS = 'relations',
	CHATS = 'chats',
	COMMENTS = 'comments',
	CATEGORIES = 'categories',
	SERIES_CATEGORIES = 'series_categories',
	ACTIVITIES = 'activities',
	/** Server-driven VXP new-user ladder state (owed vs paid); written from satellite hooks. */
	VXP_ONBOARDING = 'vxp_onboarding'
}
