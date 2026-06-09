export type AppLocale =
	| 'en'
	| 'es'
	| 'es-419'
	| 'es-MX'
	| 'es-AR'
	| 'es-CO'
	| 'pt'
	| 'pt-BR'
	| 'it'
	| 'fr'
	| 'de'
	| 'nl'
	| 'pl'
	| 'cs'
	| 'sk'
	| 'ru'
	| 'zh-Hans'
	| 'ja'
	| 'ko'
	| 'hi'
	| 'vi';

export const DEFAULT_LOCALE: AppLocale = 'en';

/**
 * Launch readiness for a locale.
 *
 * - `live` — the catalog is populated and kept fully aligned to `en`
 *   (enforced by `check:i18n`).
 * - `soon` — registered for resolution and detection, but the catalog is
 *   absent or only partial. Missing keys resolve through the `fallback`
 *   chain to `en`, so the UI always renders real copy — never a raw key.
 */
export type LocaleTier = 'live' | 'soon';

/**
 * A registered locale (BCP-47: `language[-Script][-REGION]`).
 *
 * One language splits into a neutral base plus regional variants. The base
 * carries the language's shared copy and backs its regional deltas; it is
 * marked `hidden` so it is not offered as a standalone region choice. Each
 * variant declares an ordered `fallback` chain that `t()` walks on a missing
 * key, always ending at `en`.
 *
 * `flag`, `region` and `regionLabel` describe the geographic facet so a
 * future region-aware picker can group variants under their language; the
 * current flat picker reads `id`, `label` and `short` only.
 */
export interface LocaleEntry {
	/** BCP-47 locale id and the value persisted in storage. */
	readonly id: AppLocale;
	/** Native language name, as shown to a speaker of that language. */
	readonly label: string;
	/** English name of the locale, for operator-facing surfaces. */
	readonly name: string;
	/** Short badge used by the picker rows (e.g. `EN`, `MX`). */
	readonly short: string;
	/** ISO-ish region code (`US`, `MX`, `419`, …). */
	readonly region: string;
	/** Native region label shown in the picker (`México`, `中国大陆`, …). */
	readonly regionLabel: string;
	/** Region flag emoji shown by a region-aware picker. */
	readonly flag: string;
	/** Ordered resolution chain walked on a missing key, ending at `en`. */
	readonly fallback: readonly AppLocale[];
	/** Neutral base dictionary for a language; backs its regional deltas. */
	readonly base?: boolean;
	/** Not offered as a standalone choice in the picker (base dictionaries). */
	readonly hidden?: boolean;
	/** Launch readiness — drives `check:i18n` strictness. */
	readonly tier: LocaleTier;
}

/**
 * The single source of truth for every locale the app knows about. Detection,
 * fallback resolution and the catalog checker all derive from this list.
 *
 * Today's fully-translated locales (`en`, `it`, `es`, `de`, `fr`, `pt`,
 * `zh-Hans`) are `live`; the rest are `soon` and resolve to English through
 * their `fallback` chain until their catalogs land.
 */
export const LOCALE_REGISTRY: readonly LocaleEntry[] = [
	{
		id: 'en',
		label: 'English',
		name: 'English',
		short: 'EN',
		region: 'US',
		regionLabel: 'Global',
		flag: '🌐',
		fallback: [],
		tier: 'live'
	},

	// Spanish — a hidden neutral base plus regional deltas. `es-419` is the
	// Latin-American tier most LatAm variants fall back to.
	{
		id: 'es',
		label: 'Español',
		name: 'Spanish',
		short: 'ES',
		region: 'ES',
		regionLabel: 'Español',
		flag: '🌐',
		fallback: ['en'],
		base: true,
		hidden: true,
		tier: 'live'
	},
	{
		id: 'es-419',
		label: 'Español',
		name: 'Spanish (Latin America)',
		short: '419',
		region: '419',
		regionLabel: 'Latinoamérica',
		flag: '🌎',
		fallback: ['es', 'en'],
		tier: 'soon'
	},
	{
		id: 'es-MX',
		label: 'Español',
		name: 'Spanish (Mexico)',
		short: 'MX',
		region: 'MX',
		regionLabel: 'México',
		flag: '🇲🇽',
		fallback: ['es-419', 'es', 'en'],
		tier: 'soon'
	},
	{
		id: 'es-AR',
		label: 'Español',
		name: 'Spanish (Argentina)',
		short: 'AR',
		region: 'AR',
		regionLabel: 'Argentina',
		flag: '🇦🇷',
		fallback: ['es-419', 'es', 'en'],
		tier: 'soon'
	},
	{
		id: 'es-CO',
		label: 'Español',
		name: 'Spanish (Colombia)',
		short: 'CO',
		region: 'CO',
		regionLabel: 'Colombia',
		flag: '🇨🇴',
		fallback: ['es-419', 'es', 'en'],
		tier: 'soon'
	},

	// Portuguese — Portugal is the neutral base, Brazil the populated variant.
	{
		id: 'pt',
		label: 'Português',
		name: 'Portuguese (Portugal)',
		short: 'PT',
		region: 'PT',
		regionLabel: 'Portugal',
		flag: '🇵🇹',
		fallback: ['en'],
		base: true,
		tier: 'live'
	},
	{
		id: 'pt-BR',
		label: 'Português',
		name: 'Portuguese (Brazil)',
		short: 'BR',
		region: 'BR',
		regionLabel: 'Brasil',
		flag: '🇧🇷',
		fallback: ['pt', 'en'],
		tier: 'soon'
	},

	{
		id: 'it',
		label: 'Italiano',
		name: 'Italian',
		short: 'IT',
		region: 'IT',
		regionLabel: 'Italia',
		flag: '🇮🇹',
		fallback: ['en'],
		tier: 'live'
	},
	{
		id: 'fr',
		label: 'Français',
		name: 'French',
		short: 'FR',
		region: 'FR',
		regionLabel: 'France',
		flag: '🇫🇷',
		fallback: ['en'],
		tier: 'live'
	},
	{
		id: 'de',
		label: 'Deutsch',
		name: 'German',
		short: 'DE',
		region: 'DE',
		regionLabel: 'Deutschland',
		flag: '🇩🇪',
		fallback: ['en'],
		tier: 'live'
	},
	{
		id: 'nl',
		label: 'Nederlands',
		name: 'Dutch',
		short: 'NL',
		region: 'NL',
		regionLabel: 'Nederland',
		flag: '🇳🇱',
		fallback: ['en'],
		tier: 'soon'
	},
	{
		id: 'pl',
		label: 'Polski',
		name: 'Polish',
		short: 'PL',
		region: 'PL',
		regionLabel: 'Polska',
		flag: '🇵🇱',
		fallback: ['en'],
		tier: 'soon'
	},
	{
		id: 'cs',
		label: 'Čeština',
		name: 'Czech',
		short: 'CS',
		region: 'CZ',
		regionLabel: 'Česko',
		flag: '🇨🇿',
		fallback: ['en'],
		tier: 'soon'
	},
	{
		id: 'sk',
		label: 'Slovenčina',
		name: 'Slovak',
		short: 'SK',
		region: 'SK',
		regionLabel: 'Slovensko',
		flag: '🇸🇰',
		fallback: ['en'],
		tier: 'soon'
	},
	{
		id: 'ru',
		label: 'Русский',
		name: 'Russian',
		short: 'RU',
		region: 'RU',
		regionLabel: 'Россия',
		flag: '🇷🇺',
		fallback: ['en'],
		tier: 'soon'
	},
	{
		id: 'zh-Hans',
		label: '简体中文',
		name: 'Chinese (Simplified)',
		short: 'ZH',
		region: 'CN',
		regionLabel: '中国大陆',
		flag: '🇨🇳',
		fallback: ['en'],
		tier: 'live'
	},
	{
		id: 'ja',
		label: '日本語',
		name: 'Japanese',
		short: 'JA',
		region: 'JP',
		regionLabel: '日本',
		flag: '🇯🇵',
		fallback: ['en'],
		tier: 'soon'
	},
	{
		id: 'ko',
		label: '한국어',
		name: 'Korean',
		short: 'KO',
		region: 'KR',
		regionLabel: '대한민국',
		flag: '🇰🇷',
		fallback: ['en'],
		tier: 'soon'
	},
	{
		id: 'hi',
		label: 'हिन्दी',
		name: 'Hindi',
		short: 'HI',
		region: 'IN',
		regionLabel: 'भारत',
		flag: '🇮🇳',
		fallback: ['en'],
		tier: 'soon'
	},
	{
		id: 'vi',
		label: 'Tiếng Việt',
		name: 'Vietnamese',
		short: 'VI',
		region: 'VN',
		regionLabel: 'Việt Nam',
		flag: '🇻🇳',
		fallback: ['en'],
		tier: 'soon'
	}
] as const;

/**
 * The flat list the current picker UI iterates: every locale with a populated
 * catalog (`tier: 'live'`). Carries the back-compat `{ id, label, short }`
 * shape that `LanguageSheet`, `WelcomeNav` and `SettingsPage` read today.
 *
 * The `hidden` flag (a language's neutral base) is deliberately ignored here —
 * it only matters for a future region-aware picker that groups regional
 * variants under their language. The current flat picker has no region axis,
 * so every live locale is offered directly.
 *
 * `soon` locales are registered in `LOCALE_REGISTRY` for detection and
 * fallback, but stay out of this list until their catalogs land.
 */
export const SUPPORTED_LOCALES: readonly {
	id: AppLocale;
	label: string;
	short: string;
}[] = LOCALE_REGISTRY.filter(({ tier }) => tier === 'live').map(({ id, label, short }) => ({
	id,
	label,
	short
}));

/**
 * Resolve a locale's fallback chain — itself first, then each entry in its
 * registered `fallback`, always ending at `en`. Used by `t()` to render a
 * populated locale's key when a `soon` (or partial) locale lacks it.
 */
export const localeFallbackChain = (locale: AppLocale): readonly AppLocale[] => {
	const entry = LOCALE_REGISTRY.find(({ id }) => id === locale);
	const chain: AppLocale[] = [locale];

	if (entry) {
		for (const next of entry.fallback) {
			if (!chain.includes(next)) {
				chain.push(next);
			}
		}
	}

	if (!chain.includes(DEFAULT_LOCALE)) {
		chain.push(DEFAULT_LOCALE);
	}

	return chain;
};

export const LOCALE_STORAGE_KEY = 'vici.locale.v1';
