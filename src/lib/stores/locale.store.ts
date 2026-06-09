import { browser } from '$app/environment';
import { LOCALE_STORAGE_KEY, type AppLocale } from '$lib/constants/locale.constants';
import { initStorageStore } from '$lib/stores/storage.store';
import { detectBrowserLocale } from '$lib/utils/locale.utils';
import { get as getStorage, set as setStorage } from '$lib/utils/storage.utils';
import { isNullish } from '@dfinity/utils';

// First visit vs. returning visit, with no flag to track it: the presence of
// LOCALE_STORAGE_KEY in storage *is* the signal. A saved value — whether the
// visitor picked it explicitly or it was the locale we caught for them on
// their first visit — always wins. Only when nothing is stored do we "catch"
// the device language and match it to a locale we ship.
const savedLocale = getStorage<AppLocale>({ key: LOCALE_STORAGE_KEY });
const initialLocale = savedLocale ?? detectBrowserLocale();

// Persist that first catch so it becomes the durable default: every later
// visit then resolves straight from storage and never re-detects, and an
// explicit pick from the language picker simply overwrites it. Mirrors
// oisy-wallet, which saves the resolved language on init.
if (browser && isNullish(savedLocale)) {
	setStorage({ key: LOCALE_STORAGE_KEY, value: initialLocale });
}

export const localeStore = initStorageStore<AppLocale>({
	key: LOCALE_STORAGE_KEY,
	defaultValue: initialLocale
});
