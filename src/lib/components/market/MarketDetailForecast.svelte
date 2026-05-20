<script lang="ts">
	import IconSignalNo from '$lib/components/icons/IconSignalNo.svelte';
	import IconSignalYes from '$lib/components/icons/IconSignalYes.svelte';
	import ResolvedMarketPanel from '$lib/components/market/ResolvedMarketPanel.svelte';
	import TradeModal from '$lib/components/market/TradeModal.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market, OutcomeId } from '$lib/types/market';
	import { formatProbability, formatToken } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';

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
				{t({ locale: $localeStore, key: 'market.forecast.title' })}
			</h3>

			<div class="mt-8 flex flex-col gap-4 sm:flex-row">
				<div class="flex-1 space-y-1">
					<BaseButton
						class="bg-yes text-ink shadow-yes/10 w-full rounded-2xl py-6 text-center shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
						onclick={() => handleOutcomeSelect('YES')}
					>
						<span class="text-yes-deep/70 flex items-center justify-center">
							<IconSignalYes size="28px" />
						</span>
						<span class="text-ink/70 mt-2 block text-[10px] font-black tracking-widest uppercase">
							{t({ locale: $localeStore, key: 'market.forecast.predict_yes' })}
						</span>
						<span class="text-ink text-3xl font-black">{formatProbability(yesProbability)}</span>
					</BaseButton>
					<div
						class="text-muted-foreground flex items-center justify-center gap-1.5 text-[9px] font-bold"
					>
						<span class="bg-yes h-1 w-1 rounded-full" aria-hidden="true"></span>
						<span>{t({ locale: $localeStore, key: 'market.forecast.instant_execution' })}</span>
					</div>
				</div>

				<div class="flex-1 space-y-1">
					<BaseButton
						class="bg-no text-ink shadow-no/10 w-full rounded-2xl py-6 text-center shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
						onclick={() => handleOutcomeSelect('NO')}
					>
						<span class="text-no-deep/70 flex items-center justify-center">
							<IconSignalNo size="28px" />
						</span>
						<span class="text-ink/70 mt-2 block text-[10px] font-black tracking-widest uppercase">
							{t({ locale: $localeStore, key: 'market.forecast.predict_no' })}
						</span>
						<span class="text-ink text-3xl font-black">{formatProbability(noProbability)}</span>
					</BaseButton>
					<div
						class="text-muted-foreground flex items-center justify-center gap-1.5 text-[9px] font-bold"
					>
						<span class="bg-no h-1 w-1 rounded-full" aria-hidden="true"></span>
						<span>{t({ locale: $localeStore, key: 'market.forecast.secure_settlement' })}</span>
					</div>
				</div>
			</div>

			<div class="bg-foreground/5 mt-8 flex h-2 w-full overflow-hidden rounded-full">
				<div
					style="width: {yesProbability * 100}%"
					class="bg-yes h-full transition-all duration-700"
				></div>
				<div
					style="width: {noProbability * 100}%"
					class="bg-no h-full transition-all duration-700"
				></div>
			</div>

			<div class="mt-6 flex justify-between px-2">
				<div class="flex flex-col">
					<span class="text-muted-foreground text-[10px] font-bold uppercase">
						{t({ locale: $localeStore, key: 'market.forecast.yes_volume' })}
					</span>
					<span class="text-foreground text-xs font-bold">
						{formatToken({ value: yesVolume, unitName: tokenDecimals })}
					</span>
				</div>
				<div class="flex flex-col items-end">
					<span class="text-muted-foreground text-[10px] font-bold uppercase">
						{t({ locale: $localeStore, key: 'market.forecast.no_volume' })}
					</span>
					<span class="text-foreground text-xs font-bold">
						{formatToken({ value: noVolume, unitName: tokenDecimals })}
					</span>
				</div>
			</div>
		</div>
	{:else}
		<div class="space-y-3">
			<h3 class="text-muted-foreground px-2 text-xs font-bold tracking-widest uppercase">
				{t({ locale: $localeStore, key: 'market.forecast.select_outcome' })}
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
									<span>
										{t({
											locale: $localeStore,
											key: 'market.forecast.predictions_count',
											params: { count: outcome.totalPredictions ?? 0 }
										})}
									</span>
									<span class="bg-border h-1 w-1 rounded-full" aria-hidden="true"></span>
									<span>
										{t({
											locale: $localeStore,
											key: 'market.forecast.pool',
											params: {
												amount: formatToken({
													value: outcome.volume ?? ZERO,
													unitName: tokenDecimals
												})
											}
										})}
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
