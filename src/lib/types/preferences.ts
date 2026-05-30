export type FlowSessionLength = 5 | 10 | 20;

export type SettingsVisibility = 'public' | 'friends' | 'private';

export interface NotificationPrefs {
	streakReminder: boolean;
	marketAlerts: boolean;
	friendActivity: boolean;
	weeklyDigest: boolean;
}

/**
 * Wallet-side default-bet amounts, per surface. Stored as decimal
 * strings so we can carry exact tokens without floating-point drift.
 */
export interface DefaultAmountPrefs {
	flow: string;
	manual: string;
}

/**
 * Cross-device user preferences. Lives on the profile doc
 * (`profile.preferences`); every leaf has a server-side default so
 * legacy profile rows decode cleanly. The store layer hydrates from
 * the profile on auth and writes through `upsertProfile` on every
 * change so settings sync across devices.
 */
export interface UserPreferences {
	defaultAmount: DefaultAmountPrefs;
	notify: NotificationPrefs;
	flowSessionLength: FlowSessionLength;
	hapticsEnabled: boolean;
	callsPublic: boolean;
	flowTags: string[];
	/**
	 * When `true`, Flow deck is filtered to World Cup markets only — the
	 * category-pill grid is hidden and the deck surfaces just the
	 * featured-event markets. Matches the SetSegmented control on
	 * SettingsScreen.
	 */
	worldCupMode: boolean;
	/**
	 * Market ids the user has hearted to revisit later. Round-trips
	 * through the profile so the list survives device swaps.
	 */
	savedMarketIds: string[];
	/**
	 * Featured-event participant id picked during Beat 1.a of onboarding.
	 * Empty string means the user skipped the team pick.
	 */
	favoriteParticipantId: string;
	/**
	 * YES/NO commitment locked in during Beat 1.b of onboarding. Empty
	 * string means no commitment was made (skip path).
	 */
	favoriteSide: '' | 'YES' | 'NO';
	/**
	 * Flips to `true` once the 3-beat onboarding flow finishes,
	 * regardless of which picks were ultimately persisted. Source of
	 * truth for whether to re-prompt a signed-in user on next visit.
	 */
	onboardingCompleted: boolean;
}
