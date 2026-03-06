<script lang="ts">
	import { ZERO } from '$lib/constants/app.constants';
	import { SUPPORTED_TOKENS } from '$lib/constants/tokens/tokens.ic.constants';
	import type { WalletBalance } from '$lib/types/wallet';
	import { formatToken } from '$lib/utils/format.utils';

	interface Props {
		balances: WalletBalance;
	}

	const { balances }: Props = $props();

	const getTokenColor = (symbol: string) => {
		if (symbol === 'ICP') {
			return 'indigo';
		}
		if (symbol === 'ckUSDC') {
			return 'green';
		}

		return 'slate';
	};
</script>

<div class="grid grid-cols-1 gap-4">
	{#each SUPPORTED_TOKENS as token (token.ledgerCanisterId)}
		{@const color = getTokenColor(token.symbol)}

		<div
			class="relative overflow-hidden rounded-2xl border border-{color}-100 bg-linear-to-br from-{color}-50 to-white p-6 shadow-sm"
		>
			<div class="flex items-center justify-between">
				<div class="text-xs font-bold tracking-widest text-{color}-600 uppercase">
					{token.symbol} Balance
				</div>
				<div class="h-7 w-7 rounded-full bg-{color}-100 p-1.5 text-{color}-600">
					<svg fill="currentColor" viewBox="0 0 24 24"
						><path d="M12 2L2 12l10 10 10-10L12 2z" /></svg
					>
				</div>
			</div>
			<div class="mt-2 flex items-baseline gap-2">
				<span class="text-3xl font-black text-slate-950">
					{formatToken({ value: balances.balances[token.id] ?? ZERO, unitName: token.decimals })}
				</span>
				<span class="text-lg font-bold text-slate-400 uppercase">{token.symbol}</span>
			</div>
			<div class="mt-4 flex gap-3 text-[10px] font-medium text-slate-500">
				{#if token.symbol === 'ICP'}
					<span
						>≈ ${(
							(Number(balances.balances[token.id] ?? ZERO) / 10 ** token.decimals) *
							12.5
						).toFixed(2)} USD</span
					>
				{:else if token.symbol === 'ckUSDC'}
					<span>1.00 ckUSDC = $1.00 USD</span>
				{/if}
			</div>
		</div>
	{/each}
</div>
