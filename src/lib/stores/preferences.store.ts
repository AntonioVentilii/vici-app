import { MARKET_TAGS } from '$lib/constants/market-tags.constants';
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
	callsPublic: true,
	flowTags: [...MARKET_TAGS],
	savedMarketIds: []
};

const basePreferencesStore = initStorageStore<UserPreferences>({
	key: PREFERENCES_STORAGE_KEY,
	defaultValue: DEFAULT_PREFERENCES
});

/**
 * Hydrates stored preferences against the current default shape so older
 * payloads that don't yet have a newer field (e.g. `flowTags`) still
 * load cleanly without forcing the user back into the default everywhere.
 *
 * `flowTags` replaced the legacy `flowCategories` field; we transparently
 * migrate any locally-stored payload that still carries the old name so
 * users don't notice the rename.
 */
const ensureShape = (current: UserPreferences | undefined): UserPreferences => {
	const legacyFlowCategories = (current as unknown as { flowCategories?: unknown } | undefined)
		?.flowCategories;
	const inheritedTags =
		Array.isArray(current?.flowTags) && current.flowTags.length > 0
			? current.flowTags
			: Array.isArray(legacyFlowCategories) && legacyFlowCategories.length > 0
				? (legacyFlowCategories as string[])
				: [...MARKET_TAGS];

	return {
		...DEFAULT_PREFERENCES,
		...current,
		notify: { ...DEFAULT_PREFERENCES.notify, ...(current?.notify ?? {}) },
		flowTags: inheritedTags,
		savedMarketIds: Array.isArray(current?.savedMarketIds) ? current.savedMarketIds : []
	};
};

export const preferencesStore: StorageStore<UserPreferences> = {
	...basePreferencesStore,
	subscribe: (run) => basePreferencesStore.subscribe((value) => run(ensureShape(value))),
	update: (updater) => {
		basePreferencesStore.update((current) => {
			const next = updater(ensureShape(current));
			basePreferencesStore.set({ key: PREFERENCES_STORAGE_KEY, value: next });

			return next;
		});
	}
};

export const flowSessionMaxBets = (prefs: UserPreferences): number => prefs.flowSessionLength;

/**
 * Add or remove a market id from the saved-markets list. Per-device only;
 * no backend round-trip. Returns nothing — the store mutates in place.
 */
export const toggleSavedMarket = ({ marketId }: { marketId: string }): void => {
	preferencesStore.update((current) => {
		const ids = current.savedMarketIds;
		const next = ids.includes(marketId) ? ids.filter((id) => id !== marketId) : [...ids, marketId];

		return { ...current, savedMarketIds: next };
	});
};

/** Pure helper: is this market id in the saved list? */
export const isMarketSaved = ({
	marketId,
	prefs
}: {
	marketId: string;
	prefs: UserPreferences;
}): boolean => prefs.savedMarketIds.includes(marketId);
