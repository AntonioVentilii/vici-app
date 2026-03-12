<script lang="ts">
	import type { Market } from '$lib/types/market';
	import { formatProbability, formatToken } from '$lib/utils/format.utils';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	const {
		yesProbability,
		noProbability,
		yesVolume,
		noVolume,
		payoffType,
		outcomes,
		token: { decimals: tokenDecimals }
	} = $derived(market);
</script>

<div class="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
	<h3 class="text-sm font-bold tracking-widest text-slate-500 uppercase">Market Forecast</h3>

	{#if payoffType === 'Binary'}
		<div class="relative mt-4">
			<div class="mb-1.5 flex justify-between">
				<div class="flex flex-col">
					<span class="text-2xl font-black text-slate-950">{formatProbability(yesProbability)}</span
					>
					<span class="text-[10px] font-bold text-green-600 uppercase">YES Probability</span>
				</div>
				<div class="flex flex-col items-end">
					<span class="text-2xl font-black text-slate-950">{formatProbability(noProbability)}</span>
					<span class="text-[10px] font-bold text-red-600 uppercase">NO Probability</span>
				</div>
			</div>
			<div class="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
				<div
					style="width: {yesProbability * 100}%"
					class="h-full bg-green-500 transition-all duration-700"
				></div>
				<div
					style="width: {noProbability * 100}%"
					class="h-full bg-red-500 transition-all duration-700"
				></div>
			</div>
		</div>

		<div class="mt-6 grid grid-cols-2 gap-6 border-t border-slate-100 pt-6">
			<div>
				<div class="mb-0.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
					YES Vol
				</div>
				<div class="text-lg font-bold text-slate-950">
					{formatToken({ value: yesVolume, unitName: tokenDecimals })}
				</div>
			</div>
			<div class="text-right">
				<div class="mb-0.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
					NO Vol
				</div>
				<div class="text-lg font-bold text-slate-950">
					{formatToken({ value: noVolume, unitName: tokenDecimals })}
				</div>
			</div>
		</div>
	{:else}
		<div class="mt-4 space-y-4">
			<div class="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
				{#each outcomes ?? [] as outcome, i (outcome.id)}
					<div
						style="width: {(1 / (outcomes?.length ?? 1)) *
							100}%; background-color: var(--color-indigo-{((i % 5) + 1) * 100 + 400})"
						class="h-full transition-all duration-700"
					></div>
				{/each}
			</div>

			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{#each outcomes ?? [] as outcome, i (outcome.id)}
					<div class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
						<div class="flex items-center gap-2">
							<div
								style="background-color: var(--color-indigo-{((i % 5) + 1) * 100 + 400})"
								class="h-2 w-2 rounded-full"
							></div>
							<span class="text-xs font-bold text-slate-700">{outcome.title}</span>
						</div>
						<span class="text-xs font-black text-slate-950"
							>{formatProbability(1 / (outcomes?.length ?? 1))}</span
						>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
