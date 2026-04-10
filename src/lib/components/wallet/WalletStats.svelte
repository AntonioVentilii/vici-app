<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { walletUiTokens } from '$lib/derived/tokens.derived';
	import { isDev } from '$lib/env/app.env';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import type { WalletBalance } from '$lib/types/wallet';
	import { findAssetWorthForIcrcLedger } from '$lib/utils/asset-ref.utils';
	import { formatCurrency, formatToken } from '$lib/utils/format.utils';

	interface Props {
		balances: WalletBalance | undefined;
	}

	const { balances }: Props = $props();

	let hideZeroBalances = $state(true);

	const displayedTokens = $derived(
		$walletUiTokens.filter((token) => {
			if (isNullish(balances)) {
				return false;
			}

			if (!hideZeroBalances) {
				return true;
			}

			return (balances.balances[token.id] ?? ZERO) > ZERO;
		})
	);

	const getTokenColor = (symbol: string) => {
		if (symbol === 'ICP') {
			return 'indigo';
		}

		if (symbol.startsWith('ck')) {
			return 'green';
		}

		return 'slate';
	};
</script>

<Card padding="none" variant="default">
	<div class="flex w-full items-center justify-between border-b border-slate-100 p-4">
		<h3 class="text-sm font-bold text-slate-900">Assets</h3>

		<div class="flex items-center gap-2">
			<span class="text-xs text-slate-500">Hide zero balances</span>

			<Switch bind:checked={hideZeroBalances} />
		</div>
	</div>

	<div class="flex w-full flex-col divide-y divide-slate-50">
		{#if isNullish(balances)}
			{#each { length: 3 } as _, i (i)}
				<div class="flex items-center justify-between p-4 px-6">
					<div class="flex items-center gap-3">
						<div class="h-8 w-8 animate-pulse rounded-full bg-slate-100"></div>
						<div class="h-4 w-24 animate-pulse rounded bg-slate-100"></div>
					</div>
					<div class="text-right">
						<div class="h-4 w-16 animate-pulse rounded bg-slate-100"></div>
						<div class="mt-1 h-3 w-12 animate-pulse rounded bg-slate-100"></div>
					</div>
				</div>
			{/each}
		{:else}
			{#each displayedTokens as token (token.ledgerCanisterId)}
				{@const color = getTokenColor(token.symbol)}
				{@const balance = balances.balances[token.id] ?? ZERO}
				{@const assetWorth = findAssetWorthForIcrcLedger({
					assets: balances.accountState?.assets,
					ledgerCanisterId: token.ledgerCanisterId,
					assetsConfig: $collateralsStore?.assetsConfig ?? {}
				})}

				<div class="flex items-center justify-between p-4 transition-colors hover:bg-slate-50/50">
					<div class="flex items-center gap-3">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full bg-{color}-100 text-{color}-600"
						>
							<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 2L2 12l10 10 10-10L12 2z" />
							</svg>
						</div>
						<div class="flex items-center gap-2">
							<div class="text-sm font-bold text-slate-900">{token.symbol}</div>
							{#if isDev() && token.isDevEnabled}
								<Badge size="sm" variant="warning">DEV</Badge>
							{/if}
						</div>
					</div>

					<div class="text-right">
						<div class="text-sm font-black text-slate-950">
							{formatToken({ value: balance, unitName: token.decimals })}
						</div>
						<div class="text-[10px] font-medium text-slate-400">
							{#if $playgroundVxpUnitMode}
								{token.symbol}
							{:else if assetWorth}
								≈ {formatCurrency({ value: assetWorth.value_usd })}
							{:else if token.symbol === 'ckUSDC'}
								≈ {formatCurrency({ value: balance, decimals: token.decimals })}
							{:else}
								--
							{/if}
						</div>
					</div>
				</div>
			{/each}

			{#if displayedTokens.length === 0}
				<div class="p-8 text-center text-sm text-slate-400 italic">No assets to display</div>
			{/if}
		{/if}
	</div>
</Card>
