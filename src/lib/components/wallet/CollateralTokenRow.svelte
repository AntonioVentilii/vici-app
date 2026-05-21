<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { VXP_BALANCE_DISPLAY_DECIMALS } from '$lib/constants/playground.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { isDev } from '$lib/env/app.env';
	import { formatAvailableUsd, formatToken } from '$lib/utils/format.utils';
	import { getTokenColorClasses } from '$lib/utils/token-ui.utils';

	interface Props {
		tokenSymbol: string;
		isDevEnabled?: boolean;
		balance: bigint;
		decimals: number;
		assetWorth?:
			| {
					haircut_bps: number;
					value_usd: bigint;
					pre_haircut_value_usd: bigint;
			  }
			| undefined
			| null;
	}

	const { tokenSymbol, isDevEnabled, balance, decimals, assetWorth }: Props = $props();

	const colorClasses = $derived(getTokenColorClasses(tokenSymbol));

	const isVxp = $derived(tokenSymbol === VXP_TOKEN.symbol);
</script>

<div class="hover:bg-foreground/5 flex items-center justify-between px-4 py-4 transition-colors">
	<div class="flex items-center gap-3">
		<div class="flex h-8 w-8 items-center justify-center rounded-full {colorClasses}">
			<svg class="h-4 w-4" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
				<path d="M12 2L2 12l10 10 10-10L12 2z" />
			</svg>
		</div>
		<div class="flex flex-col">
			<div class="flex items-center gap-2">
				<span class="text-foreground text-sm font-bold">{tokenSymbol}</span>
				{#if isDev() && isDevEnabled}
					<Badge size="sm" variant="warning">DEV</Badge>
				{/if}
			</div>
			{#if nonNullish(assetWorth) && assetWorth.haircut_bps > 0}
				<span class="text-primary text-[10px] font-medium">
					{assetWorth.haircut_bps / 100}% Haircut
				</span>
			{/if}
		</div>
	</div>

	<div class="text-right">
		<div class="text-foreground text-sm font-black">
			{formatToken({
				value: balance,
				unitName: decimals,
				displayDecimals: isVxp ? VXP_BALANCE_DISPLAY_DECIMALS : undefined
			})}
		</div>
		<div class="text-muted-foreground text-[10px] font-medium uppercase">
			{#if $playgroundVxpUnitMode}
				{tokenSymbol}
			{:else if nonNullish(assetWorth)}
				Value: {formatAvailableUsd({ value: assetWorth.value_usd })}
				{#if assetWorth.haircut_bps > 0}
					<span class="line-through opacity-50">
						({formatAvailableUsd({ value: assetWorth.pre_haircut_value_usd })})
					</span>
				{/if}
			{:else}
				{tokenSymbol}
			{/if}
		</div>
	</div>
</div>
