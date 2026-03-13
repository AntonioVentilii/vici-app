import type { ClearingDid } from '$declarations';
import { ordersStore } from '$lib/stores/orders.store';
import { derived, type Readable } from 'svelte/store';

export const orders: Readable<ClearingDid.LimitOrder[]> = derived(
	ordersStore,
	($ordersStore) => $ordersStore ?? []
);

export const ordersNotInitialized: Readable<boolean> = derived(
	ordersStore,
	($ordersStore) => $ordersStore === undefined
);
