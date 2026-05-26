export type FlowSessionLength = 5 | 10 | 20;

export type SettingsVisibility = 'public' | 'friends' | 'private';

export interface NotificationPrefs {
	streakReminder: boolean;
	marketAlerts: boolean;
	friendActivity: boolean;
	weeklyDigest: boolean;
}

export interface UserPreferences {
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
	/** Market ids the user has hearted to revisit later. Per-device
	 *  preference — no backend round-trip. Backed by
	 *  `localStorage['vici.saved-markets']`. */
	savedMarketIds: string[];
}
