<script lang="ts">
	import { onMount } from 'svelte';
	import type { ClearingDid } from '$declarations';
	import AtomicLoader from '$lib/components/loaders/AtomicLoader.svelte';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { loadMarkets } from '$lib/services/market.services';
	import { marketsStore } from '$lib/stores/markets.store';
	import { compareBalanceDomains } from '$lib/utils/balance-domain.utils';

	let prevDomain: ClearingDid.BalanceDomain | undefined = undefined;

	const refresh = async ({ resetStore = false } = {}) => {
		const domainToken = $balanceDomain;

		if (resetStore) {
			marketsStore.set(undefined);
		}

		// `loadMarkets` invokes `onLoad` up to twice: first with the uncertified
		// query (fast, for instant UI), then with the certified update (verified).
		// The underlying `queryAndUpdate` drops stale query responses that land
		// after the update has already settled, so we only need to guard against
		// a balance-domain switch that happened mid-flight.
		await loadMarkets({
			domain: domainToken,
			onLoad: ({ response }) => {
				// Structural compare: `balanceDomain` is a derived store that emits
				// fresh `{ Settlement: null }`-style literals, so referential `===`
				// is unreliable even when the logical domain is unchanged.
				if (compareBalanceDomains($balanceDomain, domainToken)) {
					marketsStore.set(response);
				}
			}
		});
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
