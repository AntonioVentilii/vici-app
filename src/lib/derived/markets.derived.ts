import { cachedListOrEmpty, cachedNotInitialized } from '$lib/derived/cached.derived';
import { marketsStore } from '$lib/stores/markets.store';
import type { Market } from '$lib/types/market';
import type { Readable } from 'svelte/store';

export const markets: Readable<Market[]> = cachedListOrEmpty(marketsStore);

export const marketsNotInitialized: Readable<boolean> = cachedNotInitialized(marketsStore);
