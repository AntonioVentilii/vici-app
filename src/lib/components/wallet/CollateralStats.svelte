<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import CollateralTokenRow from '$lib/components/wallet/CollateralTokenRow.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { walletUiTokens } from '$lib/derived/tokens.derived';
	import type { CollateralStoreData } from '$lib/stores/collaterals.store';
	import {
		findAssetWorthForIcrcLedger,
		icrcLedgerDecimalsFromCollateralConfig
	} from '$lib/utils/asset-ref.utils';
	import {
		calculateDepositedNominalLabel,
		calculateIntuitiveAvailable
	} from '$lib/utils/collateral-ui.utils';
	import { formatAvailableMarginForUi } from '$lib/utils/playground-display.utils';

	interface Props {
		collateral: CollateralStoreData | undefined;
		onManage: () => void;
	}

	const { collateral, onManage }: Props = $props();

	let hideZeroBalances = $state(true);

	const displayedTokens = $derived(
		$walletUiTokens.filter((token) => {
			if (isNullish(collateral)) {
				return false;
			}

			if (!hideZeroBalances) {
				return true;
			}

			return (collateral.balances[token.id] ?? ZERO) > ZERO;
		})
	);

	const depositedNominalLabel = $derived.by(() => {
		if (isNullish(collateral)) {
			return '...';
		}

		return calculateDepositedNominalLabel({ collateral, tokens: $walletUiTokens });
	});

	const intuitiveAvailable = $derived.by(() => {
		if (isNullish(collateral)) {
			return;
		}

		return calculateIntuitiveAvailable({ collateral, tokens: $walletUiTokens });
	});
</script>

<Card padding="none" variant="default">
	<div
		class="flex w-full flex-col justify-between gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center"
	>
		<div>
			<div class="flex items-center gap-3">
				<div class="text-xs font-bold tracking-widest text-indigo-600 uppercase">
					Clearing Collateral
				</div>
			</div>
			<div class="mt-1 space-y-1 text-sm text-slate-500">
				{#if isNullish(collateral)}
					<div class="h-4 w-32 animate-pulse rounded bg-slate-100"></div>
					<div class="mt-2 h-4 w-24 animate-pulse rounded bg-slate-100"></div>
				{:else if nonNullish(collateral.accountState)}
					<p>
						Deposited: <span class="font-bold text-slate-900">
							{depositedNominalLabel || '0'}
						</span>
					</p>
					<p>
						Available: <span class="font-bold text-slate-900">
							{formatAvailableMarginForUi({
								value: intuitiveAvailable ?? ZERO,
								playground: $playgroundVxpUnitMode
							})}
						</span>
					</p>
				{:else}
					<p>Sign in to see clearing collateral.</p>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-4">
			<div class="flex items-center gap-2">
				<span class="text-xs text-slate-500">Hide zero</span>
				<Switch bind:checked={hideZeroBalances} />
			</div>

			<Button onclick={onManage} variant="primary">Manage</Button>
		</div>
	</div>

	<div class="flex w-full flex-col divide-y divide-slate-50">
		{#if isNullish(collateral)}
			{#each { length: 3 } as _, i (i)}
				<div class="flex items-center justify-between p-6">
					<div class="flex items-center gap-3">
						<div class="h-10 w-10 animate-pulse rounded-full bg-slate-100"></div>
						<div class="h-4 w-24 animate-pulse rounded bg-slate-100"></div>
					</div>
					<div class="h-4 w-16 animate-pulse rounded bg-slate-100"></div>
				</div>
			{/each}
		{:else}
			{#each displayedTokens as token (token.id)}
				{@const balance = collateral.balances[token.id] ?? ZERO}
				{@const collateralDecimals = icrcLedgerDecimalsFromCollateralConfig({
					assetsConfig: collateral.assetsConfig,
					ledgerCanisterId: token.ledgerCanisterId,
					fallbackDecimals: token.decimals
				})}
				{@const assetWorth = findAssetWorthForIcrcLedger({
					assets: collateral.accountState?.assets,
					ledgerCanisterId: token.ledgerCanisterId,
					assetsConfig: collateral.assetsConfig
				})}

				<CollateralTokenRow
					{assetWorth}
					{balance}
					decimals={collateralDecimals}
					isDevEnabled={token.isDevEnabled}
					tokenSymbol={token.symbol}
				/>
			{/each}

			{#if displayedTokens.length === 0}
				<div class="p-8 text-center text-sm text-slate-400 italic">No collateral to display</div>
			{/if}
		{/if}
	</div>
</Card>
