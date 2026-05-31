export type AppLocale = 'en' | 'it' | 'es' | 'de' | 'fr' | 'pt' | 'zh-CN';

export const DEFAULT_LOCALE: AppLocale = 'en';

// TODO: Pending additional locales to support: pt-BR, nl, pl, cs, sk, ru,
// zh-Hans, ja, ko, hi, vi. The existing `zh-CN` entry corresponds to `zh-Hans`;
// reconcile the naming when these are added.
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
	{ id: 'pt', label: 'Português', short: 'PT' },
	{ id: 'zh-CN', label: '简体中文', short: 'ZH' }
] as const;

export const LOCALE_STORAGE_KEY = 'vici.locale.v1';
