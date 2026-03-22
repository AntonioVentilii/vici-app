import { BALANCE_DOMAIN_STORE_KEY, balanceDomainStore } from '$lib/stores/balance-domain.store';
import type { BalanceDomainKey } from '$lib/types/balance-domain';

/** Persists the user's selected playground vs settlement mode to the balance-domain store. */
export const setBalanceDomain = (balanceDomain: BalanceDomainKey): void => {
	balanceDomainStore.set({ key: BALANCE_DOMAIN_STORE_KEY, value: { value: balanceDomain } });
};
