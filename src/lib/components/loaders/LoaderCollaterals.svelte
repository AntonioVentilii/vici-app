<script lang="ts">
	import IdentityAwareLoader from '$lib/components/loaders/IdentityAwareLoader.svelte';
	import { getCollateralBalances } from '$lib/services/wallet.service';
	import { collateralsStore } from '$lib/stores/collaterals.store';

	const refresh = async () => {
		const collateral = await getCollateralBalances();

		collateralsStore.set(collateral);
	};
</script>

<svelte:window onviciRefreshCollaterals={refresh} />

<IdentityAwareLoader onLoad={refresh} />
