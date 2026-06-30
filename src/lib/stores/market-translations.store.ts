import { localeFallbackChain, type AppLocale } from '$lib/constants/locale.constants';
import { listMarketTranslationsForLocales } from '$lib/services/market-translation.services';
import { localeStore } from '$lib/stores/locale.store';
import { marketLanguagePreference } from '$lib/stores/market-language.store';
import type { MarketTranslation } from '$lib/types/market-translation';
import {
	marketDisplayText,
	resolveMarketTranslation,
	type MarketDisplayOriginal,
	type MarketDisplayText
} from '$lib/utils/market-translation.utils';
import { SvelteMap } from 'svelte/reactivity';
import { derived, get, writable } from 'svelte/store';

/**
 * Bulk-hydrated market-translation overlay shared by the list/deck surfaces.
 * Keyed by `seriesId`, each value is the translation resolved for the
 * **active** locale (via `resolveMarketTranslation`'s fallback chain), or
 * `undefined` when the market has no translation for that locale — which is
 * also what gates the per-card quick toggle.
 *
 * The list/deck owners call `hydrate(visibleSeriesIds)` when their data loads;
 * a single bulk read covers a whole page (the N+1 the detail-page spec called
 * out). The raw docs are cached per series so an app-locale change re-resolves
 * from cache instantly and only fetches series whose new candidate locales
 * weren't already pulled.
 */
const resolved = writable<SvelteMap<string, MarketTranslation | undefined>>(new SvelteMap());

export const marketTranslations = resolved;

// Raw docs per series across every locale fetched so far — lets a locale
// change re-resolve without a round-trip when the new chain is already covered.
const rawBySeriesId = new Map<string, MarketTranslation[]>();
// Per-series record of which locales have been requested, so a re-hydrate only
// fetches genuinely-new `(seriesId, locale)` pairs.
const fetchedLocalesBySeriesId = new Map<string, Set<string>>();

// Must stay ≤ the satellite query's `MAX_BULK_SERIES_IDS` cap. `hydrate`
// chunks the visible set to this bound so a larger page isn't truncated.
const BULK_SERIES_ID_LIMIT = 200;

const candidateLocales = (locale: AppLocale): AppLocale[] => [...localeFallbackChain(locale)];

const reResolve = (locale: AppLocale): void => {
	resolved.update((map) => {
		for (const [seriesId, docs] of rawBySeriesId.entries()) {
			map.set(seriesId, resolveMarketTranslation({ translations: docs, locale })?.translation);
		}

		return map;
	});
};

/**
 * Fetch + resolve translations for the visible series ids. Idempotent per
 * `(seriesId, locale-chain)`: ids whose current candidate locales were already
 * pulled are skipped, so calling this on every data refresh is cheap. Fails
 * open — any error leaves the existing overlay untouched, so surfaces simply
 * render the original text.
 */
export const hydrate = async (seriesIds: string[]): Promise<void> => {
	const locale = get(localeStore);
	const locales = candidateLocales(locale);

	const pending = seriesIds.filter((seriesId) => {
		const seen = fetchedLocalesBySeriesId.get(seriesId);

		return locales.some((candidate) => !(seen?.has(candidate) ?? false));
	});

	if (pending.length === 0) {
		// Still re-resolve so a locale switch reflects cached docs immediately.
		reResolve(locale);

		return;
	}

	for (const seriesId of pending) {
		const seen = fetchedLocalesBySeriesId.get(seriesId) ?? new Set<string>();

		for (const candidate of locales) {
			seen.add(candidate);
		}

		fetchedLocalesBySeriesId.set(seriesId, seen);
	}

	try {
		// The satellite query caps `seriesIds` per call (`MAX_BULK_SERIES_IDS`);
		// chunk to that bound so a visible set larger than the cap isn't silently
		// truncated — which would seed the dropped ids with empty lists and pin
		// them as "fetched" with no translation forever.
		const batches: string[][] = [];

		for (let i = 0; i < pending.length; i += BULK_SERIES_ID_LIMIT) {
			batches.push(pending.slice(i, i + BULK_SERIES_ID_LIMIT));
		}

		const docs = (
			await Promise.all(
				batches.map((seriesIds) => listMarketTranslationsForLocales({ seriesIds, locales }))
			)
		).flat();

		for (const doc of docs) {
			const existing = rawBySeriesId.get(doc.seriesId) ?? [];
			const next = existing.filter((entry) => entry.locale !== doc.locale);
			next.push(doc);
			rawBySeriesId.set(doc.seriesId, next);
		}

		// Series with no returned doc still need an entry so the overlay reads
		// `undefined` (rather than re-fetching forever) — seed an empty list.
		for (const seriesId of pending) {
			if (!rawBySeriesId.has(seriesId)) {
				rawBySeriesId.set(seriesId, []);
			}
		}

		reResolve(get(localeStore));
	} catch {
		// Fail open: drop the optimistic "fetched" marks for the pending ids so
		// a later hydrate retries, and leave the overlay as-is.
		for (const seriesId of pending) {
			fetchedLocalesBySeriesId.delete(seriesId);
		}
	}
};

/**
 * Reactive display-text resolver shared by every surface that renders a market
 * the user predicted on (portfolio, dashboard, wallet history, calibration,
 * inbox digest). Given a market it returns the {@link MarketDisplayText} for the
 * active locale + global language preference, reading the bulk-hydrated overlay
 * so a list of rows resolves from one prior `hydrate(ids)` call. Re-emits when
 * the overlay, the locale, or the preference change.
 *
 * The market must already be hydrated (the surface owner calls `hydrate(ids)`);
 * an un-hydrated id resolves to `undefined` and renders the on-chain original.
 */
export const marketDisplay = derived(
	[resolved, marketLanguagePreference],
	([$resolved, $preference]) =>
		(market: MarketDisplayOriginal & { id: string }): MarketDisplayText =>
			marketDisplayText({
				market,
				translation: $resolved.get(market.id),
				showOriginal: $preference === 'original'
			})
);

// Re-resolve every known series whenever the app locale changes. The first
// emission (current locale) is a no-op against an empty cache; subsequent
// changes re-pick the best translation per series and pull any series whose
// new candidate locales weren't covered yet.
let lastLocale: AppLocale | undefined;
localeStore.subscribe((locale) => {
	if (locale === lastLocale) {
		return;
	}

	lastLocale = locale;
	reResolve(locale);

	const knownIds = [...rawBySeriesId.keys()];

	if (knownIds.length > 0) {
		void hydrate(knownIds);
	}
});
