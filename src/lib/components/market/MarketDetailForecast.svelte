<script lang="ts">
	import ResolvedMarketPanel from '$lib/components/market/ResolvedMarketPanel.svelte';
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
		status,
		token: { decimals: tokenDecimals }
	} = $derived(market);

	const isResolved = $derived(status === 'Resolved');

	const handleOutcomeSelect = (id: OutcomeId) => {
		if (isResolved) {
			return;
		}

		selectedOutcomeId = id;
		onOutcomeSelect?.(id);
	};
</script>

{#if selectedOutcomeId && !isResolved}
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
	{#if isResolved}
		<ResolvedMarketPanel {market} />
	{:else if payoffType === 'Binary'}
		<div class="border-border bg-card rounded-3xl border p-8">
			<h3 class="text-muted-foreground text-center text-xs font-bold tracking-widest uppercase">
				Market Forecast
			</h3>

			<div class="mt-8 flex flex-col gap-4 sm:flex-row">
				<div class="flex-1 space-y-1">
					<BaseButton
						class="bg-success shadow-success/10 w-full rounded-2xl py-6 text-center shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
						onclick={() => handleOutcomeSelect('YES')}
					>
						<span class="block text-[10px] font-black tracking-widest text-white/70 uppercase">
							Predict YES
						</span>
						<span class="text-3xl font-black text-white">{formatProbability(yesProbability)}</span>
					</BaseButton>
					<div
						class="text-muted-foreground flex items-center justify-center gap-1.5 text-[9px] font-bold"
					>
						<span class="bg-yes h-1 w-1 rounded-full"></span>
						<span>INSTANT EXECUTION</span>
					</div>
				</div>

				<div class="flex-1 space-y-1">
					<BaseButton
						class="bg-destructive shadow-destructive/10 w-full rounded-2xl py-6 text-center shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
						onclick={() => handleOutcomeSelect('NO')}
					>
						<span class="block text-[10px] font-black tracking-widest text-white/70 uppercase">
							Predict NO
						</span>
						<span class="text-3xl font-black text-white">{formatProbability(noProbability)}</span>
					</BaseButton>
					<div
						class="text-muted-foreground flex items-center justify-center gap-1.5 text-[9px] font-bold"
					>
						<span class="bg-destructive h-1 w-1 rounded-full"></span>
						<span>SECURE SETTLEMENT</span>
					</div>
				</div>
			</div>

			<div class="bg-foreground/5 mt-8 flex h-2 w-full overflow-hidden rounded-full">
				<div
					style="width: {yesProbability * 100}%"
					class="h-full bg-green-500 transition-all duration-700"
				></div>
				<div
					style="width: {noProbability * 100}%"
					class="bg-destructive h-full transition-all duration-700"
				></div>
			</div>

			<div class="mt-6 flex justify-between px-2">
				<div class="flex flex-col">
					<span class="text-muted-foreground text-[10px] font-bold uppercase">YES Vol</span>
					<span class="text-foreground text-xs font-bold">
						{formatToken({ value: yesVolume, unitName: tokenDecimals })}
					</span>
				</div>
				<div class="flex flex-col items-end">
					<span class="text-muted-foreground text-[10px] font-bold uppercase">NO Vol</span>
					<span class="text-foreground text-xs font-bold">
						{formatToken({ value: noVolume, unitName: tokenDecimals })}
					</span>
				</div>
			</div>
		</div>
	{:else}
		<div class="space-y-3">
			<h3 class="text-muted-foreground px-2 text-xs font-bold tracking-widest uppercase">
				Select an outcome
			</h3>

			<div class="space-y-3">
				{#each outcomes ?? [] as outcome (outcome.id)}
					<BaseButton
						class="group border-border bg-card hover:border-primary/30 relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all hover:shadow-md active:scale-[0.99]"
						onclick={() => handleOutcomeSelect(outcome.id)}
					>
						<div class="relative z-10 flex items-center justify-between">
							<div class="space-y-1">
								<span class="text-foreground group-hover:text-primary block text-lg font-black">
									{outcome.title}
								</span>
								<div
									class="text-muted-foreground flex items-center gap-3 text-[10px] font-bold uppercase"
								>
									<span>{outcome.totalPredictions ?? 0} predictions</span>
									<span class="bg-border h-1 w-1 rounded-full"></span>
									<span>
										{formatToken({
											value: outcome.volume ?? ZERO,
											unitName: tokenDecimals
										})} pool
									</span>
								</div>
							</div>

							<div class="text-right">
								<div
									class="bg-primary/10 text-primary inline-flex items-center rounded-lg px-3 py-1"
								>
									<span class="text-lg font-black">
										{formatProbability(outcome.probability ?? 0)}
									</span>
								</div>
							</div>
						</div>

						<div class="bg-foreground/5 absolute bottom-0 left-0 h-1 w-full">
							<div
								style="width: {(outcome.probability ?? 0) * 100}%"
								class="bg-primary h-full opacity-20 transition-all duration-700"
							></div>
						</div>
					</BaseButton>
				{/each}
			</div>
		</div>
	{/if}
</div>
