export type AppLocale = 'en' | 'it';

export const DEFAULT_LOCALE: AppLocale = 'en';

export const SUPPORTED_LOCALES: readonly { id: AppLocale; label: string }[] = [
	{ id: 'en', label: 'English' },
	{ id: 'it', label: 'Italiano' }
] as const;

export const LOCALE_STORAGE_KEY = 'vici.locale.v1';
