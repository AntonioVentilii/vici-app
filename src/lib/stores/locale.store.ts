import { browser } from '$app/environment';
import { LOCALE_STORAGE_KEY, type AppLocale } from '$lib/constants/locale.constants';
import { initStorageStore } from '$lib/stores/storage.store';
import { detectBrowserLocale } from '$lib/utils/locale.utils';
import { has as hasStorage, set as setStorage } from '$lib/utils/storage.utils';

// First visit: "catch" the device language and match it to a locale we ship.
// `initStorageStore` performs the authoritative "stored value wins, else
// default" read, so we hand it the detected locale as the default and let it
// own the single parse of LOCALE_STORAGE_KEY.
const detectedLocale = detectBrowserLocale();

export const localeStore = initStorageStore<AppLocale>({
	key: LOCALE_STORAGE_KEY,
	defaultValue: detectedLocale
});

// Persist that first catch so it becomes the durable default: every later
// visit then resolves straight from storage and never re-detects, and an
// explicit pick from the language picker simply overwrites it. A presence
// check (no parse, silent on failure) is enough to tell a first visit from a
// returning one — we don't need the stored value here, only whether one
// exists. Mirrors oisy-wallet, which saves the resolved language on init.
if (browser && !hasStorage({ key: LOCALE_STORAGE_KEY })) {
	setStorage({ key: LOCALE_STORAGE_KEY, value: detectedLocale });
}
