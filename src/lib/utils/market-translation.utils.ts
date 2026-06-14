import {
	DEFAULT_LOCALE,
	localeFallbackChain,
	SUPPORTED_LOCALES,
	type AppLocale
} from '$lib/constants/locale.constants';
import type { MarketTranslation } from '$lib/types/market-translation';

const supportedLocaleIds = new Set<string>(SUPPORTED_LOCALES.map(({ id }) => id));

/**
 * Pick the translation to show a reader on a given locale, walking the
 * locale's fallback chain (itself → registered fallbacks → `en`) and taking
 * the first entry that is both a `live` (`SUPPORTED_LOCALES`) locale and has a
 * stored translation.
 *
 * `DEFAULT_LOCALE` (`en`) is treated as the original-authoring language, never
 * a translation: a reader whose chain resolves only to `en` is already seeing
 * the source text, so there is nothing to toggle and the result is `undefined`.
 */
export const resolveMarketTranslation = ({
	translations,
	locale
}: {
	translations: readonly MarketTranslation[];
	locale: AppLocale;
}): { translation: MarketTranslation; locale: AppLocale } | undefined => {
	const byLocale = new Map(translations.map((entry) => [entry.locale, entry]));

	for (const candidate of localeFallbackChain(locale)) {
		if (candidate !== DEFAULT_LOCALE && supportedLocaleIds.has(candidate)) {
			const translation = byLocale.get(candidate);

			if (translation) {
				return { translation, locale: candidate };
			}
		}
	}
};
