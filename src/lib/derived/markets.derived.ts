import { marketsStore } from '$lib/stores/markets.store';
import type { Market } from '$lib/types/market';
import { derived, type Readable } from 'svelte/store';

export const markets: Readable<Market[]> = derived(
	marketsStore,
	($marketsStore) => $marketsStore ?? []
);

export const marketsNotInitialized: Readable<boolean> = derived(
	marketsStore,
	($marketsStore) => $marketsStore === undefined
);
