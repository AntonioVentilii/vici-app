<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import Badge from '$lib/components/ui/Badge.svelte';
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
</script>

<div class="flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50/50">
	<div class="flex items-center gap-3">
		<div class="flex h-8 w-8 items-center justify-center rounded-full {colorClasses}">
			<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
				<path d="M12 2L2 12l10 10 10-10L12 2z" />
			</svg>
		</div>
		<div class="flex flex-col">
			<div class="flex items-center gap-2">
				<span class="text-sm font-bold text-slate-900">{tokenSymbol}</span>
				{#if isDev() && isDevEnabled}
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
			{formatToken({ value: balance, unitName: decimals })}
		</div>
		<div class="text-[10px] font-medium text-slate-400 uppercase">
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
