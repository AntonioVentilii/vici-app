import type { ClearingDid } from '$declarations';
import { initCertifiedStore } from '$lib/stores/certified.store';

export const orderBookStore = initCertifiedStore<ClearingDid.LimitOrder[], string>();
