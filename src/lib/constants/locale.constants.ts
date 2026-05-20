export type AppLocale = 'en' | 'it' | 'es' | 'de' | 'fr' | 'pt';

export const DEFAULT_LOCALE: AppLocale = 'en';

export const SUPPORTED_LOCALES: readonly {
	id: AppLocale;
	label: string;
	short: string;
}[] = [
	{ id: 'en', label: 'English', short: 'EN' },
	{ id: 'it', label: 'Italiano', short: 'IT' },
	{ id: 'es', label: 'Español', short: 'ES' },
	{ id: 'de', label: 'Deutsch', short: 'DE' },
	{ id: 'fr', label: 'Français', short: 'FR' },
	{ id: 'pt', label: 'Português', short: 'PT' }
] as const;

export const LOCALE_STORAGE_KEY = 'vici.locale.v1';
