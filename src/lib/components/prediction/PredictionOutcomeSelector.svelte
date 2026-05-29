<script lang="ts">
	import IconSignalNo from '$lib/components/icons/IconSignalNo.svelte';
	import IconSignalYes from '$lib/components/icons/IconSignalYes.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import type { OrderType } from '$lib/types/order';
	import type { PositionType } from '$lib/types/position';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	interface Props {
		market: Market;
		selectedType: PositionType;
		yesProbability: number;
		noProbability: number;
		orderType: OrderType;
		onSelect: (args: { outcomeId: string; probability?: number }) => void;
	}

	let { market, selectedType, yesProbability, noProbability, orderType, onSelect }: Props =
		$props();

	const tr = ({ key, params }: { key: MessageKey; params?: Record<string, string | number> }) =>
		t({ locale: $localeStore, key, params });
</script>

<div class="grid grid-cols-2 gap-4">
	{#if market.payoffType === 'Binary'}
		<BaseButton
			class="group relative overflow-hidden rounded-2xl border-2 px-6 py-4 {selectedType === 'YES'
				? 'border-yes bg-yes-wash text-yes'
				: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
			onclick={() => onSelect({ outcomeId: 'YES', probability: yesProbability })}
		>
			<div class="relative z-10 flex flex-col items-center gap-1">
				<IconSignalYes size="22px" />
				<span class="eyebrow-xs">
					{tr({ key: 'prediction.choice.label' })}
				</span>
				<span class="text-xl font-black">{tr({ key: 'outcome.yes' })}</span>
				{#if orderType === 'MARKET'}
					<span class="text-[10px] font-medium opacity-60">
						{(yesProbability * 100).toFixed(1)}%
					</span>
				{/if}
			</div>
		</BaseButton>

		<BaseButton
			class="group relative overflow-hidden rounded-2xl border-2 px-6 py-4 {selectedType === 'NO'
				? 'border-destructive bg-destructive/10 text-destructive'
				: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
			onclick={() => onSelect({ outcomeId: 'NO', probability: noProbability })}
		>
			<div class="relative z-10 flex flex-col items-center gap-1">
				<IconSignalNo size="22px" />
				<span class="eyebrow-xs">
					{tr({ key: 'prediction.choice.label' })}
				</span>
				<span class="text-xl font-black">{tr({ key: 'outcome.no' })}</span>
				{#if orderType === 'MARKET'}
					<span class="text-[10px] font-medium opacity-60">
						{(noProbability * 100).toFixed(1)}%
					</span>
				{/if}
			</div>
		</BaseButton>
	{:else}
		<div class="col-span-2 grid grid-cols-2 gap-3">
			{#each market.outcomes ?? [] as outcome (outcome.id)}
				<BaseButton
					class="group relative overflow-hidden rounded-2xl border-2 px-4 py-4 {selectedType ===
					outcome.id
						? 'border-primary bg-primary/10 text-primary'
						: 'border-border bg-foreground/5 text-muted-foreground hover:border-foreground/10'}"
					onclick={() => onSelect({ outcomeId: outcome.id })}
				>
					<div class="relative z-10 flex flex-col items-center gap-0.5">
						<span class="eyebrow-xs">
							{tr({ key: 'prediction.choice.label' })}
						</span>
						<span class="text-center text-sm font-black">{outcome.title}</span>
					</div>
				</BaseButton>
			{/each}
		</div>
	{/if}
</div>
