<script lang="ts">
	import { onMount } from 'svelte';
	import type { ClearingDid } from '$declarations';
	import AtomicLoader from '$lib/components/loaders/AtomicLoader.svelte';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { getMarkets } from '$lib/services/market.services';
	import { marketsStore } from '$lib/stores/markets.store';
	import { compareBalanceDomains } from '$lib/utils/balance-domain.utils';

	let prevDomain: ClearingDid.BalanceDomain | undefined = undefined;

	const refresh = async ({ resetStore = false } = {}) => {
		const domainToken = $balanceDomain;

		if (resetStore) {
			marketsStore.set(undefined);
		}

		const markets = await getMarkets(domainToken);

		// Only update if the domain hasn't changed during the fetch
		if ($balanceDomain === domainToken) {
			marketsStore.set(markets);
		}
	};

	let shouldUseSlowInterval = false;

	onMount(() => {
		const timeout = setTimeout(() => {
			shouldUseSlowInterval = true;
		}, 30_000);

		return () => {
			clearTimeout(timeout);
		};
	});

	// eslint-disable-next-line require-await
	const onShouldUseSlowInterval = async (): Promise<boolean> => shouldUseSlowInterval;

	$effect(() => {
		if ($balanceDomain && (!prevDomain || !compareBalanceDomains($balanceDomain, prevDomain))) {
			prevDomain = $balanceDomain;
			refresh({ resetStore: true });
		}
	});
</script>

<svelte:document onviciRefreshMarkets={() => refresh()} />

<AtomicLoader onLoad={refresh} {onShouldUseSlowInterval} />
