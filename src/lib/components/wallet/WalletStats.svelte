<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
	import { isDev } from '$lib/env/app.env';
	import type { WalletBalance } from '$lib/types/wallet';
	import { formatToken } from '$lib/utils/format.utils';

	interface Props {
		balances: WalletBalance;
	}

	const { balances }: Props = $props();

	let hideZeroBalances = $state(true);

	const displayedTokens = $derived(
		SUPPORTED_TOKENS.filter((token) => {
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
		{#each displayedTokens as token (token.ledgerCanisterId)}
			{@const color = getTokenColor(token.symbol)}
			{@const balance = balances.balances[token.id] ?? ZERO}
			{@const assetWorth = balances.accountState?.assets.find(
				(a) => a.asset_id === token.symbol.toLowerCase()
			)}

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
						{#if assetWorth}
							≈ ${(
								Number(assetWorth.value_usd) / (Number(assetWorth.balance) || 1) / 10 ** 8 || 0
							).toFixed(2)} USD
						{:else if token.symbol === 'ICP'}
							≈ ${((Number(balance) / 10 ** token.decimals) * 12.5).toFixed(2)} USD
						{:else if token.symbol === 'ckUSDC'}
							≈ ${formatToken({ value: balance, unitName: token.decimals })} USD
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
	</div>
</Card>
