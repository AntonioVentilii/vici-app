<script lang="ts">
	import LoaderBalances from '$lib/components/loaders/LoaderBalances.svelte';
	import LoaderCollaterals from '$lib/components/loaders/LoaderCollaterals.svelte';
	import LoaderMarkets from '$lib/components/loaders/LoaderMarkets.svelte';
	import LoaderOrders from '$lib/components/loaders/LoaderOrders.svelte';
	import PlaygroundVxpAutoDeposit from '$lib/components/wallet/PlaygroundVxpAutoDeposit.svelte';
</script>

<PlaygroundVxpAutoDeposit />

<LoaderBalances />

<LoaderCollaterals />

<LoaderOrders />

<LoaderMarkets />
