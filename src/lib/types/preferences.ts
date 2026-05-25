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
	/** Market ids the user has hearted to revisit later. Per-device
	 *  preference — no backend round-trip. Mirrors the prototype's
	 *  `localStorage['vici.saved-markets']`. */
	savedMarketIds: string[];
}
