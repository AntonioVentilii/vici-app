<script lang="ts">
	import { isNullish, nonNullish } from '@dfinity/utils';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { VICI_TOKEN, VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { walletUiTokens } from '$lib/derived/tokens.derived';
	import { isDev } from '$lib/env/app.env';
	import type { CollateralStoreData } from '$lib/stores/collaterals.store';
	import { findAssetWorthForIcrcLedger } from '$lib/utils/asset-ref.utils';
	import { formatAvailableUsd, formatToken } from '$lib/utils/format.utils';
	import {
		formatAvailableMarginForUi,
		intuitiveAvailableMarginUsd,
		nativeToClearingMarginUnits
	} from '$lib/utils/playground-display.utils';

	interface Props {
		collateral: CollateralStoreData;
		onManage: () => void;
	}

	const { collateral, onManage }: Props = $props();

	let hideZeroBalances = $state(true);

	const displayedTokens = $derived(
		$walletUiTokens.filter((token) => {
			if (!hideZeroBalances) {
				return true;
			}
			return (collateral.balances[token.id] ?? ZERO) > ZERO;
		})
	);

	const depositedNominalLabel = $derived.by(() => {
		const parts: string[] = [];
		for (const t of $walletUiTokens) {
			const b = collateral.balances[t.id] ?? ZERO;
			if (b !== ZERO) {
				parts.push(`${formatToken({ value: b, unitName: t.decimals })} ${t.symbol}`);
			}
		}
		return parts.join(' · ');
	});

	const fallbackCollateralMarginUnits = $derived.by(() => {
		let total = ZERO;
		for (const t of $walletUiTokens) {
			const b = collateral.balances[t.id] ?? ZERO;
			if (b > ZERO) {
				total += nativeToClearingMarginUnits({
					nativeBalance: b,
					nativeDecimals: Number(t.decimals)
				});
			}
		}
		return total;
	});

	const intuitiveAvailable = $derived.by(() => {
		const a = collateral.accountState;
		if (isNullish(a)) {
			return undefined;
		}
		return intuitiveAvailableMarginUsd({
			assets: a.assets,
			totalEquityUsd: a.total_equity_usd,
			availableMarginUsd: a.available_margin_usd,
			fallbackCollateralMarginUnits
		});
	});

	const getTokenColorClasses = (symbol: string) => {
		if (symbol === 'ICP') {
			return 'bg-indigo-100 text-indigo-600';
		}
		if (symbol.startsWith('ck')) {
			return 'bg-green-100 text-green-600';
		}
		if (symbol === VXP_TOKEN.symbol || symbol === VICI_TOKEN.symbol) {
			return 'bg-violet-100 text-violet-600';
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
			</div>
			<div class="mt-1 space-y-1 text-sm text-slate-500">
				{#if nonNullish(collateral.accountState)}
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
		{#each displayedTokens as token (token.id)}
			{@const balance = collateral.balances[token.id] ?? ZERO}
			{@const colorClasses = getTokenColorClasses(token.symbol)}
			{@const assetWorth = findAssetWorthForIcrcLedger({
				assets: collateral.accountState?.assets,
				ledgerCanisterId: token.ledgerCanisterId,
				assetsConfig: collateral.assetsConfig
			})}

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
						{#if nonNullish(assetWorth) && assetWorth.haircut_bps > 0}
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
						{#if $playgroundVxpUnitMode}
							{token.symbol}
						{:else if nonNullish(assetWorth)}
							Value: {formatAvailableUsd({ value: assetWorth.value_usd })}
							{#if assetWorth.haircut_bps > 0}
								<span class="line-through opacity-50">
									({formatAvailableUsd({ value: assetWorth.pre_haircut_value_usd })})
								</span>
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
