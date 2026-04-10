<script lang="ts">
	import type { ClearingDid } from '$declarations';
	import IdentityAwareLoader from '$lib/components/loaders/IdentityAwareLoader.svelte';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { getCollateralAssets } from '$lib/services/collateral.services';
	import { getBalances } from '$lib/services/wallet.service';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { compareBalanceDomains } from '$lib/utils/balance-domain.utils';

	let prevDomain: ClearingDid.BalanceDomain | undefined = undefined;

	const refresh = async ({ resetStore = false } = {}) => {
		const domainToken = $balanceDomain;

		if (resetStore) {
			collateralsStore.set(undefined);
		}

		const [{ collateral, accountState }, assets] = await Promise.all([
			getBalances(domainToken),
			getCollateralAssets()
		]);

		// Only update if the domain hasn't changed during the fetch
		if ($balanceDomain !== domainToken) {
			return;
		}

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
		if ($balanceDomain && (!prevDomain || !compareBalanceDomains($balanceDomain, prevDomain))) {
			prevDomain = $balanceDomain;
			refresh({ resetStore: true });
		}
	});
</script>

<svelte:window onviciRefreshCollaterals={() => refresh()} />

<IdentityAwareLoader onLoad={refresh} />
