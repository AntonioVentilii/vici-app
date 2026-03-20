<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
	import { isDev } from '$lib/env/app.env';
	import type { CollateralStoreData } from '$lib/stores/collaterals.store';
	import { formatAvailableUsd, formatToken } from '$lib/utils/format.utils';

	interface Props {
		collateral: CollateralStoreData;
		onManage: () => void;
	}

	const { collateral, onManage }: Props = $props();

	let hideZeroBalances = $state(true);

	const displayedTokens = $derived(
		SUPPORTED_TOKENS.filter((token) => {
			if (!hideZeroBalances) {
				return true;
			}
			return (collateral.balances[token.id] ?? ZERO) > ZERO;
		})
	);

	const getTokenColorClasses = (symbol: string) => {
		if (symbol === 'ICP') {
			return 'bg-indigo-100 text-indigo-600';
		}
		if (symbol.startsWith('ck')) {
			return 'bg-green-100 text-green-600';
		}
		return 'bg-slate-100 text-slate-600';
	};
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
				{#if collateral.accountState}
					<Badge variant="success">
						{formatAvailableUsd({ value: collateral.accountState.total_equity_usd })} Total
					</Badge>
				{/if}
			</div>
			<p class="mt-1 text-sm text-slate-500">
				{#if collateral.accountState}
					Available Equity: <span class="font-bold text-slate-900">
						{formatAvailableUsd({ value: collateral.accountState.available_margin_usd })}
					</span>
				{:else}
					Locked and available margin for trading
				{/if}
			</p>
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
		{#each displayedTokens as token (token.id)}
			{@const balance = collateral.balances[token.id] ?? ZERO}
			{@const colorClasses = getTokenColorClasses(token.symbol)}
			{@const assetWorth = collateral.accountState?.assets.find(
				(a) => a.asset_id === token.symbol.toLowerCase()
			)}

			<div
				class="flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50/50"
			>
				<div class="flex items-center gap-3">
					<div class="flex h-8 w-8 items-center justify-center rounded-full {colorClasses}">
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 2L2 12l10 10 10-10L12 2z" />
						</svg>
					</div>
					<div class="flex flex-col">
						<div class="flex items-center gap-2">
							<span class="text-sm font-bold text-slate-900">{token.symbol}</span>
							{#if isDev() && token.isDevEnabled}
								<Badge size="sm" variant="warning">DEV</Badge>
							{/if}
						</div>
						{#if assetWorth && assetWorth.haircut_bps > 0}
							<span class="text-[10px] font-medium text-orange-500">
								{assetWorth.haircut_bps / 100}% Haircut
							</span>
						{/if}
					</div>
				</div>

				<div class="text-right">
					<div class="text-sm font-black text-slate-950">
						{formatToken({ value: balance, unitName: token.decimals })}
					</div>
					<div class="text-[10px] font-medium text-slate-400 uppercase">
						{#if assetWorth}
							Value: {formatAvailableUsd({ value: assetWorth.value_usd })}
							{#if assetWorth.haircut_bps > 0}
								<span class="line-through opacity-50"
									>({formatAvailableUsd({ value: assetWorth.pre_haircut_value_usd })})</span
								>
							{/if}
						{:else}
							{token.symbol}
						{/if}
					</div>
				</div>
			</div>
		{/each}

		{#if displayedTokens.length === 0}
			<div class="p-8 text-center text-sm text-slate-400 italic">No collateral to display</div>
		{/if}
	</div>
</Card>
