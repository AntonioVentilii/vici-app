<script lang="ts">
	import LoaderBalances from '$lib/components/loaders/LoaderBalances.svelte';
	import LoaderCategories from '$lib/components/loaders/LoaderCategories.svelte';
	import LoaderCollaterals from '$lib/components/loaders/LoaderCollaterals.svelte';
	import LoaderFollowing from '$lib/components/loaders/LoaderFollowing.svelte';
	import LoaderGlobalActivities from '$lib/components/loaders/LoaderGlobalActivities.svelte';
	import LoaderLeaderboard from '$lib/components/loaders/LoaderLeaderboard.svelte';
	import LoaderMarkets from '$lib/components/loaders/LoaderMarkets.svelte';
	import LoaderOrders from '$lib/components/loaders/LoaderOrders.svelte';
	import LoaderPositions from '$lib/components/loaders/LoaderPositions.svelte';
	import LoaderTradeHistory from '$lib/components/loaders/LoaderTradeHistory.svelte';
	import PlaygroundVxpAutoDeposit from '$lib/components/wallet/PlaygroundVxpAutoDeposit.svelte';
</script>

<PlaygroundVxpAutoDeposit />

<LoaderBalances />

<LoaderCollaterals />

<LoaderOrders />

<LoaderMarkets />

<LoaderPositions />

<LoaderTradeHistory />

<LoaderCategories />

<LoaderLeaderboard />

<LoaderFollowing />

<LoaderGlobalActivities />
