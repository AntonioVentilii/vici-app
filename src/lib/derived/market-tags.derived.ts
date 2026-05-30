import type { MarketTag } from '$lib/constants/market-tags.constants';
import { cachedNotInitialized } from '$lib/derived/cached.derived';
import { marketTagsStore } from '$lib/stores/market-tags.store';
import { derived, type Readable } from 'svelte/store';

const EMPTY_TAGS: Record<string, MarketTag[]> = {};

/**
 * Cached `seriesId → MarketTag[]` lookup. Falls back to an empty object so
 * consumers can read it without a nullish-check on every render. Pair
 * with {@link marketTagsNotInitialized} when the page also needs to
 * distinguish "still loading" from "loaded but empty".
 */
export const marketTags: Readable<Record<string, MarketTag[]>> = derived(
	marketTagsStore,
	($store) => $store ?? EMPTY_TAGS
);

export const marketTagsNotInitialized: Readable<boolean> = cachedNotInitialized(marketTagsStore);
