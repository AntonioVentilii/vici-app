<script lang="ts">
	import { isNullish } from '@dfinity/utils';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { VXP_BALANCE_DISPLAY_DECIMALS } from '$lib/constants/playground.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { walletUiTokens } from '$lib/derived/tokens.derived';
	import { isDev } from '$lib/env/app.env';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { localeStore } from '$lib/stores/locale.store';
	import type { WalletBalance } from '$lib/types/wallet';
	import { findAssetWorthForIcrcLedger } from '$lib/utils/asset-ref.utils';
	import { formatCurrency, formatToken } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

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
</script>

<Card class="bg-card/85 h-full overflow-hidden" padding="none" variant="default">
	<div class="border-border flex w-full items-center justify-between gap-4 border-b p-4">
		<div>
			<p class="eyebrow">{t({ locale: $localeStore, key: 'wallet.stats.assets_eyebrow' })}</p>
			<h3 class="text-foreground mt-1 text-sm font-bold">
				{t({ locale: $localeStore, key: 'wallet.stats.token_balances' })}
			</h3>
		</div>

		<div class="bg-foreground/5 flex items-center gap-2 rounded-full px-3 py-1.5">
			<span class="text-muted-foreground text-xs">
				{t({ locale: $localeStore, key: 'wallet.stats.hide_zero_balances' })}
			</span>

			<Switch bind:checked={hideZeroBalances} />
		</div>
	</div>

	<div class="divide-border flex w-full flex-col divide-y">
		{#if isNullish(balances)}
			{#each { length: 3 } as _, i (i)}
				<div class="flex items-center justify-between p-4">
					<div class="flex items-center gap-3">
						<div class="bg-foreground/10 h-8 w-8 animate-pulse rounded-full"></div>
						<div class="bg-foreground/10 h-4 w-24 animate-pulse rounded"></div>
					</div>
					<div class="text-right">
						<div class="bg-foreground/10 h-4 w-16 animate-pulse rounded"></div>
						<div class="bg-foreground/10 mt-1 h-3 w-12 animate-pulse rounded"></div>
					</div>
				</div>
			{/each}
		{:else}
			{#each displayedTokens as token (token.ledgerCanisterId)}
				{@const balance = balances.balances[token.id] ?? ZERO}
				{@const assetWorth = findAssetWorthForIcrcLedger({
					assets: balances.accountState?.assets,
					ledgerCanisterId: token.ledgerCanisterId,
					assetsConfig: $collateralsStore?.assetsConfig ?? {}
				})}

				<div class="hover:bg-foreground/5 flex items-center justify-between p-4 transition-colors">
					<div class="flex items-center gap-3">
						<div
							class="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full"
						>
							<svg class="h-4 w-4" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 2L2 12l10 10 10-10L12 2z" />
							</svg>
						</div>
						<div class="flex items-center gap-2">
							<div class="text-foreground text-sm font-bold">{token.symbol}</div>
							{#if isDev() && token.isDevEnabled}
								<Badge size="sm" variant="warning">
									{t({ locale: $localeStore, key: 'wallet.badge.dev' })}
								</Badge>
							{/if}
						</div>
					</div>

					<div class="text-right">
						<div class="text-foreground font-mono text-sm font-black tabular-nums">
							{formatToken({
								value: balance,
								unitName: token.decimals,
								displayDecimals:
									token.symbol === VXP_TOKEN.symbol ? VXP_BALANCE_DISPLAY_DECIMALS : undefined
							})}
						</div>
						<div class="text-muted-foreground font-mono text-[10px] font-medium">
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
				<div class="text-muted-foreground p-8 text-center text-sm">
					{t({ locale: $localeStore, key: 'wallet.stats.empty' })}
				</div>
			{/if}
		{/if}
	</div>
</Card>
