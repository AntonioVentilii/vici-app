import { cachedListOrEmpty, cachedNotInitialized } from '$lib/derived/cached.derived';
import { categoriesStore } from '$lib/stores/categories.store';
import type { SeriesCategory } from '$lib/types/category';
import type { Readable } from 'svelte/store';

export const categories: Readable<SeriesCategory[]> = cachedListOrEmpty(categoriesStore);

export const categoriesNotInitialized: Readable<boolean> = cachedNotInitialized(categoriesStore);
