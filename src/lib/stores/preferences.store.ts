import { PREFERENCES_STORAGE_KEY } from '$lib/constants/settings.constants';
import { initStorageStore, type StorageStore } from '$lib/stores/storage.store';
import type { UserPreferences } from '$lib/types/preferences';

export const DEFAULT_PREFERENCES: UserPreferences = {
	notify: {
		streakReminder: true,
		marketAlerts: true,
		friendActivity: false,
		weeklyDigest: true
	},
	flowSessionLength: 10,
	hapticsEnabled: true,
	callsPublic: true
};

const basePreferencesStore = initStorageStore<UserPreferences>({
	key: PREFERENCES_STORAGE_KEY,
	defaultValue: DEFAULT_PREFERENCES
});

export const preferencesStore: StorageStore<UserPreferences> = {
	...basePreferencesStore,
	update: (updater) => {
		basePreferencesStore.update((current) => {
			const next = updater(current);
			basePreferencesStore.set({ key: PREFERENCES_STORAGE_KEY, value: next });

			return next;
		});
	}
};

export const flowSessionMaxBets = (prefs: UserPreferences): number => prefs.flowSessionLength;
