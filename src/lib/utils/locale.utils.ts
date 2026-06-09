import { browser } from '$app/environment';
import {
	DEFAULT_LOCALE,
	LOCALE_REGISTRY,
	SUPPORTED_LOCALES,
	type AppLocale
} from '$lib/constants/locale.constants';
import { nonNullish } from '@dfinity/utils';

/**
 * Resolve the locale to seed the app with on a first-time visit — before the
 * visitor has ever made an explicit choice. The device language is "caught"
 * from `navigator.languages` / `navigator.language` and matched against the
 * locales we actually ship, falling back to English when nothing fits.
 *
 * Matching is two-tier and walks the navigator list in priority order:
 *
 * 1. **Exact tag** (case-insensitive) — a browser tag that exactly matches a
 *    shipped locale wins (e.g. a `zh-Hans` browser → `zh-Hans`).
 * 2. **Primary subtag** — `pt-BR`, `pt-PT` and `pt` all resolve to `pt`, and
 *    `de-DE` / `de-AT` / `de` to `de`, so a regional variant maps onto its base
 *    catalog instead of dropping to English. A region-specific catalog (e.g.
 *    `pt-BR`) isn't browser-detected while it's `soon` — it's offered in the
 *    picker, not auto-selected.
 *
 * This is the seed only: once a choice exists in storage it always wins, so
 * detection never overrides an explicit pick.
 */
export const detectBrowserLocale = (): AppLocale => {
	if (!browser || typeof navigator === 'undefined') {
		return DEFAULT_LOCALE;
	}

	const tags: readonly string[] =
		navigator.languages && navigator.languages.length > 0
			? navigator.languages
			: navigator.language
				? [navigator.language]
				: [];

	const ids = SUPPORTED_LOCALES.map(({ id }) => id);

	for (const tag of tags) {
		const exact = ids.find((id) => id.toLowerCase() === tag.toLowerCase());

		if (nonNullish(exact)) {
			return exact;
		}

		const primary = tag.split('-')[0].toLowerCase();
		const base = ids.find((id) => id.split('-')[0].toLowerCase() === primary);

		if (nonNullish(base)) {
			return base;
		}
	}

	return DEFAULT_LOCALE;
};

/**
 * The country a locale places the user in — its ISO region code (`IT`,
 * `MX`, `BR`, …), which doubles as the join key against featured-event
 * participants (World Cup teams are ISO-3166 alpha-2). This is our only
 * "where is the user from" signal: the locale they picked (or the device
 * language we detected) carries a region.
 *
 * Returns `undefined` (caller skips the boost) for locales whose region
 * isn't a reliable country signal:
 *
 * - **Supra-national** (`worldFlag` — `en` Global, `es-419` Latin
 *   America): no single country.
 * - **Language bases** (`base` — `es` → `ES`, `pt` → `PT`):
 *   `detectBrowserLocale` collapses every regional browser tag onto its
 *   base (an `es-MX` or `pt-BR` device seeds `es` / `pt`), so a base
 *   locale's region would pin auto-detected users to the wrong nation
 *   (a Mexican boosted toward Spain). Only an explicitly country-scoped
 *   locale (`es-MX`, `it`, `de`, …) carries a trustworthy country.
 */
export const localeCountryCode = (locale: AppLocale): string | undefined => {
	const entry = LOCALE_REGISTRY.find(({ id }) => id === locale);

	if (nonNullish(entry) && entry.worldFlag !== true && entry.base !== true) {
		return entry.region;
	}
};
