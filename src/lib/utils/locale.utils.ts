import { browser } from '$app/environment';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type AppLocale } from '$lib/constants/locale.constants';
import { nonNullish } from '@dfinity/utils';

/**
 * Resolve the locale to seed the app with on a first-time visit — before the
 * visitor has ever made an explicit choice. The device language is "caught"
 * from `navigator.languages` / `navigator.language` and matched against the
 * locales we actually ship, falling back to English when nothing fits.
 *
 * Matching is two-tier and walks the navigator list in priority order:
 *
 * 1. **Exact tag** (case-insensitive) — a `pt-BR` browser lands on the
 *    `pt-BR` locale rather than collapsing onto a bare `pt` primary subtag.
 * 2. **Primary subtag** — `de-DE`, `de-AT` and `de` all resolve to `de`, so a
 *    regional variant maps onto its base catalog instead of dropping to
 *    English.
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
