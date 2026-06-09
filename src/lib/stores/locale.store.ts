import { browser } from '$app/environment';
import { LOCALE_STORAGE_KEY, type AppLocale } from '$lib/constants/locale.constants';
import { initStorageStore } from '$lib/stores/storage.store';
import { detectBrowserLocale } from '$lib/utils/locale.utils';
import { del as delStorage, has as hasStorage, set as setStorage } from '$lib/utils/storage.utils';
import { readonly, writable } from 'svelte/store';

// First visit: "catch" the device language and match it to a locale we ship.
// `initStorageStore` performs the authoritative "stored value wins, else
// default" read, so we hand it the detected locale as the default and let it
// own the single parse of LOCALE_STORAGE_KEY.
//
// Exported so the picker can surface the auto-detected locale under its
// "Suggested" section and label the "Use automatic" reset with the region it
// would fall back to.
export const detectedLocale = detectBrowserLocale();

export const localeStore = initStorageStore<AppLocale>({
	key: LOCALE_STORAGE_KEY,
	defaultValue: detectedLocale
});

// Separate flag marking that the active locale is an explicit user pick rather
// than the auto-detected seed. The locale value itself is always persisted
// (the first-visit catch below), so its mere presence can't distinguish a seed
// from a choice — this boolean does. The picker reads it to decide whether to
// show the "Use automatic" reset, and clearing it falls the app back to
// detection.
const LOCALE_EXPLICIT_KEY = 'vici.locale.explicit.v1';

const explicitChoice = writable<boolean>(
	browser ? hasStorage({ key: LOCALE_EXPLICIT_KEY }) : false
);

/** Whether the active locale is an explicit user choice (vs. the detected seed). */
export const localeChoiceExplicit = readonly(explicitChoice);

// Persist that first catch so it becomes the durable default: every later
// visit then resolves straight from storage and never re-detects, and an
// explicit pick from the picker simply overwrites it. A presence check (no
// parse, silent on failure) is enough to tell a first visit from a returning
// one — we don't need the stored value here, only whether one exists.
if (browser && !hasStorage({ key: LOCALE_STORAGE_KEY })) {
	setStorage({ key: LOCALE_STORAGE_KEY, value: detectedLocale });
}

/**
 * Apply an explicit locale choice from the picker: persist the locale and mark
 * it as a deliberate pick so the "Use automatic" reset becomes available.
 */
export const setLocale = (locale: AppLocale): void => {
	localeStore.set({ key: LOCALE_STORAGE_KEY, value: locale });
	setStorage({ key: LOCALE_EXPLICIT_KEY, value: true });
	explicitChoice.set(true);
};

/**
 * Drop the explicit choice and fall the app back to the auto-detected locale.
 * Clears the explicit flag and resets the active locale to what the device
 * language resolves to today, so a later visit re-detects from a clean slate.
 */
export const clearLocaleChoice = (): void => {
	delStorage({ key: LOCALE_EXPLICIT_KEY });
	explicitChoice.set(false);

	// `reset` removes the persisted locale (not just overwrites it) and sets the
	// in-memory store back to the detected seed. Removing the key is what lets a
	// later visit re-detect from a clean slate — the first-visit catch above
	// re-persists a fresh detection on next load. Overwriting with the current
	// `detectedLocale` would instead leave a stored value that pins the locale.
	localeStore.reset({ key: LOCALE_STORAGE_KEY });
};
