<script lang="ts">
	import { get } from 'svelte/store';
	import type { ClearingDid } from '$declarations';
	import AtomicLoader from '$lib/components/loaders/AtomicLoader.svelte';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { loadMarketsProgressive } from '$lib/services/market.services';
	import { marketsStore } from '$lib/stores/markets.store';
	import { compareBalanceDomains } from '$lib/utils/balance-domain.utils';

	let prevDomain: ClearingDid.BalanceDomain | undefined = undefined;

	const refresh = async ({ resetStore = false } = {}) => {
		const domainToken = $balanceDomain;

		if (resetStore) {
			marketsStore.set(undefined);
		}

		// Carry prior prices forward on a same-domain refresh so rows don't flash
		// back to 0.5 before re-enrichment; on a domain switch the store was just
		// cleared, so there's nothing (correctly) to carry.
		const previous = resetStore ? undefined : get(marketsStore);

		// Progressive load: the order-book-free lite set lands first (instant,
		// unblocking the shell's cold-load), then book-derived prices fill in
		// batch-by-batch in the background. Each update is dropped if a
		// balance-domain switch landed mid-flight, and `isStale` aborts the
		// in-flight enrichment so a superseded run stops fetching.
		await loadMarketsProgressive({
			domain: domainToken,
			previous,
			onUpdate: (markets) => {
				// Structural compare: `balanceDomain` is a derived store that emits
				// fresh `{ Settlement: null }`-style literals, so referential `===`
				// is unreliable even when the logical domain is unchanged.
				if (compareBalanceDomains($balanceDomain, domainToken)) {
					marketsStore.set(markets);
				}
			},
			isStale: () => !compareBalanceDomains($balanceDomain, domainToken)
		});
	};

	// Markets are public and effectively static between trades, so there's no
	// need to poll fast after sign-in: a single load plus the
	// `viciRefreshMarkets` event (fired on create / trade / resolve) keeps the
	// list current, with a slow background refresh as a backstop. Polling fast
	// here would re-run the catalog-wide book enrichment every second.
	// eslint-disable-next-line require-await
	const alwaysSlow = async (): Promise<boolean> => true;

	$effect(() => {
		if ($balanceDomain && (!prevDomain || !compareBalanceDomains($balanceDomain, prevDomain))) {
			prevDomain = $balanceDomain;
			refresh({ resetStore: true });
		}
	});
</script>

<svelte:document onviciRefreshMarkets={() => refresh()} />

<AtomicLoader onLoad={refresh} onShouldUseSlowInterval={alwaysSlow} />
