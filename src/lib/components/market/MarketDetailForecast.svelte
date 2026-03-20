<script lang="ts">
	import TradeModal from '$lib/components/market/TradeModal.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import type { Market, OutcomeId } from '$lib/types/market';
	import { formatProbability, formatToken } from '$lib/utils/format.utils';

	interface Props {
		market: Market;
		onOutcomeSelect?: (id: OutcomeId) => void;
		onPredictionPlaced?: () => void;
	}

	const { market, onOutcomeSelect, onPredictionPlaced }: Props = $props();

	let selectedOutcomeId = $state<OutcomeId | undefined>();

	const {
		yesProbability,
		noProbability,
		yesVolume,
		noVolume,
		payoffType,
		outcomes,
		token: { decimals: tokenDecimals }
	} = $derived(market);

	const handleOutcomeSelect = (id: OutcomeId) => {
		selectedOutcomeId = id;
		onOutcomeSelect?.(id);
	};
</script>

{#if selectedOutcomeId}
	<TradeModal
		{market}
		onClose={() => (selectedOutcomeId = undefined)}
		onPredictionPlaced={() => {
			selectedOutcomeId = undefined;
			onPredictionPlaced?.();
		}}
		selectedOutcome={selectedOutcomeId}
	/>
{/if}

<div class="mx-auto max-w-2xl space-y-6">
	{#if payoffType === 'Binary'}
		<div class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
			<h3 class="text-center text-xs font-bold tracking-widest text-slate-400 uppercase">
				Market Forecast
			</h3>

			<div class="mt-8 flex flex-col gap-4 sm:flex-row">
				<div class="flex-1 space-y-1">
					<BaseButton
						class="w-full rounded-2xl bg-emerald-500 py-6 text-center shadow-lg shadow-emerald-500/10 transition-transform hover:scale-[1.02] active:scale-[0.98]"
						onclick={() => handleOutcomeSelect('YES')}
					>
						<span class="block text-[10px] font-black tracking-widest text-white/70 uppercase"
							>Predict YES</span
						>
						<span class="text-3xl font-black text-white">{formatProbability(yesProbability)}</span>
					</BaseButton>
					<div class="flex items-center justify-center gap-1.5 text-[9px] font-bold text-slate-400">
						<span class="h-1 w-1 rounded-full bg-emerald-500"></span>
						<span>INSTANT EXECUTION</span>
					</div>
				</div>

				<div class="flex-1 space-y-1">
					<BaseButton
						class="w-full rounded-2xl bg-rose-500 py-6 text-center shadow-lg shadow-rose-500/10 transition-transform hover:scale-[1.02] active:scale-[0.98]"
						onclick={() => handleOutcomeSelect('NO')}
					>
						<span class="block text-[10px] font-black tracking-widest text-white/70 uppercase"
							>Predict NO</span
						>
						<span class="text-3xl font-black text-white">{formatProbability(noProbability)}</span>
					</BaseButton>
					<div class="flex items-center justify-center gap-1.5 text-[9px] font-bold text-slate-400">
						<span class="h-1 w-1 rounded-full bg-rose-500"></span>
						<span>SECURE SETTLEMENT</span>
					</div>
				</div>
			</div>

			<div class="mt-8 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
				<div
					style="width: {yesProbability * 100}%"
					class="h-full bg-green-500 transition-all duration-700"
				></div>
				<div
					style="width: {noProbability * 100}%"
					class="h-full bg-red-500 transition-all duration-700"
				></div>
			</div>

			<div class="mt-6 flex justify-between px-2">
				<div class="flex flex-col">
					<span class="text-[10px] font-bold text-slate-400 uppercase">YES Vol</span>
					<span class="text-xs font-bold text-slate-600"
						>{formatToken({ value: yesVolume, unitName: tokenDecimals })}</span
					>
				</div>
				<div class="flex flex-col items-end">
					<span class="text-[10px] font-bold text-slate-400 uppercase">NO Vol</span>
					<span class="text-xs font-bold text-slate-600"
						>{formatToken({ value: noVolume, unitName: tokenDecimals })}</span
					>
				</div>
			</div>
		</div>
	{:else}
		<div class="space-y-3">
			<h3 class="px-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
				Select an outcome
			</h3>

			<div class="space-y-3">
				{#each outcomes ?? [] as outcome (outcome.id)}
					<BaseButton
						class="group relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-indigo-300 hover:shadow-md active:scale-[0.99]"
						onclick={() => handleOutcomeSelect(outcome.id)}
					>
						<div class="relative z-10 flex items-center justify-between">
							<div class="space-y-1">
								<span class="block text-lg font-black text-slate-900 group-hover:text-indigo-600">
									{outcome.title}
								</span>
								<div class="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase">
									<span>{outcome.totalPredictions ?? 0} predictions</span>
									<span class="h-1 w-1 rounded-full bg-slate-200"></span>
									<span
										>{formatToken({
											value: outcome.volume ?? ZERO,
											unitName: tokenDecimals
										})} pool</span
									>
								</div>
							</div>

							<div class="text-right">
								<div
									class="inline-flex items-center rounded-lg bg-indigo-50 px-3 py-1 text-indigo-600"
								>
									<span class="text-lg font-black"
										>{formatProbability(outcome.probability ?? 0)}</span
									>
								</div>
							</div>
						</div>

						<div class="absolute bottom-0 left-0 h-1 w-full bg-slate-50">
							<div
								style="width: {(outcome.probability ?? 0) * 100}%"
								class="h-full bg-indigo-500 opacity-20 transition-all duration-700"
							></div>
						</div>
					</BaseButton>
				{/each}
			</div>
		</div>
	{/if}
</div>
