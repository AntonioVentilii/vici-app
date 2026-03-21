<script lang="ts">
	import { onMount } from 'svelte';
	import AtomicLoader from '$lib/components/loaders/AtomicLoader.svelte';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { getMarkets } from '$lib/services/market.services';
	import { marketsStore } from '$lib/stores/markets.store';

	const refresh = async () => {
		const markets = await getMarkets();

		marketsStore.set(markets);
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
		if ($balanceDomain) {
			refresh();
		}
	});
</script>

<svelte:document onviciRefreshMarkets={refresh} />

<AtomicLoader onLoad={refresh} {onShouldUseSlowInterval} />
