import type { Market } from '$lib/types/market';
import { writable } from 'svelte/store';

export const marketsStore = writable<Market[] | undefined>(undefined);
