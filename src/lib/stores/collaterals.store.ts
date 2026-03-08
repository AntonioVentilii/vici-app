import type { TokenId } from '$lib/types/token';
import { writable } from 'svelte/store';

export type CollateralStoreData = Record<TokenId, bigint>;

export const collateralsStore = writable<CollateralStoreData>({});
