<script lang="ts">
	import IdentityAwareLoader from '$lib/components/loaders/IdentityAwareLoader.svelte';
	import { getLedgerBalances } from '$lib/services/wallet.service';
	import { balancesStore } from '$lib/stores/balances.store';

	const refresh = async () => {
		const balances = await getLedgerBalances();

		balancesStore.set(balances);
	};
</script>

<svelte:window onviciRefreshBalances={refresh} />

<IdentityAwareLoader onLoad={refresh} />
