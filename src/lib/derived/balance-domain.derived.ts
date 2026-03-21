import type { ClearingDid } from '$declarations';
import { balanceDomainStore } from '$lib/stores/balance-domain.store';
import type { BalanceDomainKey } from '$lib/types/balance-domain';
import { derived, type Readable } from 'svelte/store';

export const balanceDomainValue: Readable<BalanceDomainKey> = derived(
	balanceDomainStore,
	($balanceDomainStore) => $balanceDomainStore.value
);

export const balanceDomain: Readable<ClearingDid.BalanceDomain> = derived(
	balanceDomainStore,
	($balanceDomainStore) =>
		$balanceDomainStore.value === 'settlement' ? { Settlement: null } : { Playground: null }
);
