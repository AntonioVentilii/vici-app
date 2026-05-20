import {
	DEFAULT_LOCALE,
	LOCALE_STORAGE_KEY,
	type AppLocale
} from '$lib/constants/locale.constants';
import { initStorageStore } from '$lib/stores/storage.store';

export const localeStore = initStorageStore<AppLocale>({
	key: LOCALE_STORAGE_KEY,
	defaultValue: DEFAULT_LOCALE
});
