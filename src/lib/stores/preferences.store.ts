import { PREFERENCES_STORAGE_KEY } from '$lib/constants/settings.constants';
import { initStorageStore, type StorageStore } from '$lib/stores/storage.store';
import type { UserPreferences } from '$lib/types/preferences';
import { FLOW_ART_CATEGORIES } from '$lib/utils/flow-art.utils';

export const DEFAULT_PREFERENCES: UserPreferences = {
	notify: {
		streakReminder: true,
		marketAlerts: true,
		friendActivity: false,
		weeklyDigest: true
	},
	flowSessionLength: 10,
	hapticsEnabled: true,
	callsPublic: true,
	flowCategories: [...FLOW_ART_CATEGORIES]
};

const basePreferencesStore = initStorageStore<UserPreferences>({
	key: PREFERENCES_STORAGE_KEY,
	defaultValue: DEFAULT_PREFERENCES
});

/**
 * Hydrates stored preferences against the current default shape so older
 * payloads that don't yet have a newer field (e.g. `flowCategories`) still
 * load cleanly without forcing the user back into the default everywhere.
 */
const ensureShape = (current: UserPreferences | undefined): UserPreferences => ({
	...DEFAULT_PREFERENCES,
	...current,
	notify: { ...DEFAULT_PREFERENCES.notify, ...(current?.notify ?? {}) },
	flowCategories:
		Array.isArray(current?.flowCategories) && current.flowCategories.length > 0
			? current.flowCategories
			: [...FLOW_ART_CATEGORIES]
});

export const preferencesStore: StorageStore<UserPreferences> = {
	...basePreferencesStore,
	update: (updater) => {
		basePreferencesStore.update((current) => {
			const next = updater(ensureShape(current));
			basePreferencesStore.set({ key: PREFERENCES_STORAGE_KEY, value: next });

			return next;
		});
	}
};

export const flowSessionMaxBets = (prefs: UserPreferences): number => prefs.flowSessionLength;
