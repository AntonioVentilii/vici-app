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

<Card class="bg-card/85 h-full overflow-hidden" padding="none" variant="default">
	<div
		class="border-border flex w-full flex-col justify-between gap-4 border-b p-4 sm:flex-row sm:items-center"
	>
		<div>
			<div class="flex items-center gap-3">
				<div class="eyebrow text-primary">Clearing Collateral</div>
			</div>
			<div class="text-muted-foreground mt-1 space-y-1 text-sm">
				{#if isNullish(collateral)}
					<div class="bg-foreground/10 h-4 w-32 animate-pulse rounded"></div>
					<div class="bg-foreground/10 mt-2 h-4 w-24 animate-pulse rounded"></div>
				{:else if nonNullish(collateral.accountState)}
					<p>
						Deposited: <span class="text-foreground font-mono font-bold tabular-nums">
							{depositedNominalLabel || '0'}
						</span>
					</p>
					<p>
						Available: <span class="text-foreground font-mono font-bold tabular-nums">
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

		<div class="flex flex-wrap items-center gap-3">
			<div class="bg-foreground/5 flex items-center gap-2 rounded-full px-3 py-1.5">
				<span class="text-muted-foreground text-xs">Hide zero</span>
				<Switch bind:checked={hideZeroBalances} />
			</div>

			<Button onclick={onManage} size="sm" variant="primary">Manage</Button>
		</div>
	</div>

	<div class="divide-border flex w-full flex-col divide-y">
		{#if isNullish(collateral)}
			{#each { length: 3 } as _, i (i)}
				<div class="flex items-center justify-between p-4">
					<div class="flex items-center gap-3">
						<div class="bg-foreground/10 h-8 w-8 animate-pulse rounded-full"></div>
						<div class="bg-foreground/10 h-4 w-24 animate-pulse rounded"></div>
					</div>
					<div class="bg-foreground/10 h-4 w-16 animate-pulse rounded"></div>
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
				<div class="text-muted-foreground p-8 text-center text-sm">No collateral to display</div>
			{/if}
		{/if}
	</div>
</Card>
