import { cachedListOrEmpty, cachedNotInitialized } from '$lib/derived/cached.derived';
import { positionsStore } from '$lib/stores/positions.store';
import type { Position } from '$lib/types/position';
import type { Readable } from 'svelte/store';

export const positions: Readable<Position[]> = cachedListOrEmpty(positionsStore);

export const positionsNotInitialized: Readable<boolean> = cachedNotInitialized(positionsStore);
