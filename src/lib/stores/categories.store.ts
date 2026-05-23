import type { SeriesCategory } from '$lib/types/category';
import { writable } from 'svelte/store';

/**
 * Cached series-to-category mappings. Public read (no identity required, no
 * balance domain) — populated once by `LoaderCategories` and reused by every
 * page that needs to resolve a market category (markets feed, portfolio,
 * position tables).
 */
export const categoriesStore = writable<SeriesCategory[] | undefined>(undefined);
