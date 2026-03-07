<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
	import { isDev } from '$lib/env/app.env';
	import type { TokenId } from '$lib/types/token';
	import { formatToken } from '$lib/utils/format.utils';

	interface Props {
		collateral: Record<TokenId, bigint>;
		onManage: () => void;
	}

	const { collateral, onManage }: Props = $props();

	let hideZeroBalances = $state(true);

	const displayedTokens = $derived(
		SUPPORTED_TOKENS.filter((token) => {
			if (!hideZeroBalances) {
				return true;
			}
			return (collateral[token.id] ?? ZERO) > ZERO;
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
	<div
		class="flex w-full flex-col justify-between gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center"
	>
		<div>
			<div class="text-xs font-bold tracking-widest text-indigo-600 uppercase">
				Clearing Collateral
			</div>
			<p class="mt-1 text-sm text-slate-500">Locked and available margin for trading</p>
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
			{@const balance = collateral[token.id] ?? ZERO}
			{@const color = getTokenColor(token.symbol)}

			<div
				class="flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50/50"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full bg-{color}-100 text-{color}-600"
					>
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 2L2 12l10 10 10-10L12 2z" />
						</svg>
					</div>
					<div class="flex items-center gap-2">
						<span class="text-sm font-bold text-slate-900">{token.symbol}</span>
						{#if isDev() && token.isDevEnabled}
							<Badge size="sm" variant="warning">DEV</Badge>
						{/if}
					</div>
				</div>

				<div class="text-right">
					<div class="text-sm font-black text-slate-950">
						{formatToken({ value: balance, unitName: token.decimals })}
					</div>
					<div class="text-[10px] font-medium text-slate-400 uppercase">
						{token.symbol}
					</div>
				</div>
			</div>
		{/each}

		{#if displayedTokens.length === 0}
			<div class="p-8 text-center text-sm text-slate-400 italic">No collateral to display</div>
		{/if}
	</div>
</Card>
