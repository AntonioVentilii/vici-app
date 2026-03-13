<script lang="ts">
	import IdentityAwareLoader from '$lib/components/loaders/IdentityAwareLoader.svelte';
	import { getMarkets } from '$lib/services/market.services';
	import { marketsStore } from '$lib/stores/markets.store';

	const refresh = async () => {
		const markets = await getMarkets();

		marketsStore.set(markets);
	};
</script>

<svelte:document onviciRefreshMarkets={refresh} />

<IdentityAwareLoader onLoad={refresh} />
