import { initCertifiedStore } from '$lib/stores/certified.store';
import type { OrderBook } from '$lib/types/order';

export const orderBookStore = initCertifiedStore<OrderBook>();
