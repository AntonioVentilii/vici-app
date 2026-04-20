<script lang="ts">
	import type { ClearingDid } from '$declarations';
	import IdentityAwareLoader from '$lib/components/loaders/IdentityAwareLoader.svelte';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { loadUserOrders } from '$lib/services/order.services';
	import { ordersStore } from '$lib/stores/orders.store';
	import { compareBalanceDomains } from '$lib/utils/balance-domain.utils';

	let prevDomain: ClearingDid.BalanceDomain | undefined = undefined;

	const refresh = async ({ resetStore = false } = {}) => {
		const domainToken = $balanceDomain;

		if (resetStore) {
			ordersStore.set(undefined);
		}

		await loadUserOrders({
			domain: domainToken,
			onLoad: ({ response }) => {
				// Structural compare: `balanceDomain` is a derived store that emits
				// fresh `{ Settlement: null }`-style literals, so referential `===`
				// is unreliable even when the logical domain is unchanged.
				if (compareBalanceDomains($balanceDomain, domainToken)) {
					ordersStore.set(response);
				}
			}
		});
	};

	$effect(() => {
		if ($balanceDomain && (!prevDomain || !compareBalanceDomains($balanceDomain, prevDomain))) {
			prevDomain = $balanceDomain;
			refresh({ resetStore: true });
		}
	});
</script>

<svelte:document onviciRefreshOrders={() => refresh()} />

<IdentityAwareLoader onLoad={refresh} />
