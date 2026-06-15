import { localeFallbackChain, type AppLocale } from '$lib/constants/locale.constants';
import { listMarketTranslationsForLocales } from '$lib/services/market-translation.services';
import { localeStore } from '$lib/stores/locale.store';
import type { MarketTranslation } from '$lib/types/market-translation';
import { resolveMarketTranslation } from '$lib/utils/market-translation.utils';
import { SvelteMap } from 'svelte/reactivity';
import { get, writable } from 'svelte/store';

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
		const docs = await listMarketTranslationsForLocales({ seriesIds: pending, locales });

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
