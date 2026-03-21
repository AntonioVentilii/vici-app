<script lang="ts">
	import type { ClearingDid } from '$declarations';
	import IdentityAwareLoader from '$lib/components/loaders/IdentityAwareLoader.svelte';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { getCollateralAssets } from '$lib/services/collateral.services';
	import { getBalances } from '$lib/services/wallet.service';
	import { collateralsStore } from '$lib/stores/collaterals.store';

	const refresh = async () => {
		const [{ collateral, accountState }, assets] = await Promise.all([
			getBalances(),
			getCollateralAssets()
		]);

		const assetsConfig: Record<string, ClearingDid.CollateralAssetInfo> = {};

		assets.forEach((asset) => {
			assetsConfig[asset.config.asset_id] = asset;
		});

		collateralsStore.set({
			balances: collateral,
			accountState,
			assetsConfig
		});
	};

	$effect(() => {
		if ($balanceDomain) {
			refresh();
		}
	});
</script>

<svelte:window onviciRefreshCollaterals={refresh} />

<IdentityAwareLoader onLoad={refresh} />
