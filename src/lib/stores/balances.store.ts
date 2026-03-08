import type { TokenId } from '$lib/types/token';
import { writable } from 'svelte/store';

export type BalanceStoreData = Record<TokenId, bigint>;

export const balancesStore = writable<BalanceStoreData>({});
