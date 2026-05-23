export type AppLocale = 'en' | 'it' | 'es' | 'de' | 'fr' | 'pt' | 'zh-CN';

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
	{ id: 'pt', label: 'Português', short: 'PT' },
	{ id: 'zh-CN', label: '简体中文', short: 'ZH' }
] as const;

export const LOCALE_STORAGE_KEY = 'vici.locale.v1';

/**
 * Rust-safe alias for every `AppLocale`. The Juno → Sputnik code generator
 * turns `j.enum([...])` variants directly into Rust enum identifiers, which
 * means values containing hyphens (e.g. `'zh-CN'`) emit invalid Rust like
 * `Zh-CN,` and Sputnik fails to compile with
 * `error: expected one of '(', ',', '=', '{', or '}', found '-'`.
 *
 * If you ever need to expose locales through a satellite typed query / update
 * (where `j.string()` isn't tight enough), feed the schema with `Object.values`
 * of this map instead of the raw `AppLocale` values, and translate at the
 * service boundary using `toAppLocale`.
 *
 * The `Record<AppLocale, ...>` type makes this both ways type-safe:
 *  - missing entries → TS error (the satellite would otherwise break at build)
 *  - extra entries with unknown keys → TS error (key must be `AppLocale`)
 * Add a new locale to `AppLocale` and TypeScript will tell you exactly where.
 */
export const APP_LOCALE_RUST_NAMES = {
	en: 'En',
	it: 'It',
	es: 'Es',
	de: 'De',
	fr: 'Fr',
	pt: 'Pt',
	'zh-CN': 'ZhCN'
} as const satisfies Record<AppLocale, string>;

export type RustSafeLocale = (typeof APP_LOCALE_RUST_NAMES)[AppLocale];

/**
 * Reverse map: Rust-safe identifier → `AppLocale`. Derived from
 * `APP_LOCALE_RUST_NAMES` so the two stay in lock-step automatically; you
 * never edit this by hand.
 */
export const RUST_NAME_TO_APP_LOCALE = Object.fromEntries(
	(Object.entries(APP_LOCALE_RUST_NAMES) as [AppLocale, RustSafeLocale][]).map(
		([locale, rust]) => [rust, locale] as const
	)
) as Record<RustSafeLocale, AppLocale>;

export const toRustLocale = (locale: AppLocale): RustSafeLocale => APP_LOCALE_RUST_NAMES[locale];

export const toAppLocale = (rust: RustSafeLocale): AppLocale => RUST_NAME_TO_APP_LOCALE[rust];
