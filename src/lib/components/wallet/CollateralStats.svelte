<script lang="ts">
	import { formatToken } from '$lib/utils/format.utils';
	import { findTokenByLedgerId } from '$lib/utils/tokens.utils';

	interface Props {
		collateral: Record<string, bigint>;
		onManage: () => void;
	}

	const { collateral, onManage }: Props = $props();

	const getTokenData = (assetId: string) => {
		const token = findTokenByLedgerId(assetId);

		return {
			symbol: token?.symbol ?? 'Unknown',
			decimals: token?.decimals ?? 8
		};
	};
</script>

<div
	class="relative overflow-hidden rounded-2xl border border-indigo-100 bg-linear-to-br from-indigo-50 to-white p-6 shadow-sm md:col-span-2"
>
	<div class="flex items-center justify-between">
		<div>
			<div class="text-xs font-bold tracking-widest text-indigo-600 uppercase">
				Clearing Collateral
			</div>
			<p class="text-xs text-slate-500">Locked and available margin for trading</p>
		</div>
		<button
			class="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-[0.98]"
			onclick={onManage}
		>
			Manage Collateral
		</button>
	</div>
	<div class="mt-4 flex flex-col gap-2">
		{#each Object.entries(collateral) as [assetId, balance] (assetId)}
			{@const { symbol, decimals } = getTokenData(assetId)}

			<div class="flex items-baseline gap-2">
				<span class="text-2xl font-black text-slate-950">
					{formatToken({
						value: balance,
						unitName: decimals
					})}
				</span>
				<span class="text-sm font-bold text-slate-400 uppercase">
					{symbol}
				</span>
			</div>
		{/each}

		{#if Object.keys(collateral).length === 0}
			<span class="text-2xl font-black text-slate-300">0.00</span>
		{/if}
	</div>
</div>
