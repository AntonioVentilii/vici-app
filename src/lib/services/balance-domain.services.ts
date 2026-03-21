import { BALANCE_DOMAIN_STORE_KEY, balanceDomainStore } from '$lib/stores/balance-domain.store';
import type { BalanceDomainKey } from '$lib/types/balance-domain';

export const setBalanceDomain = (balanceDomain: BalanceDomainKey): void => {
	balanceDomainStore.set({ key: BALANCE_DOMAIN_STORE_KEY, value: { value: balanceDomain } });
};
