<script lang="ts">
	import { nonNullish } from '@dfinity/utils';
	import { CheckCircle2 } from 'lucide-svelte/icons';
	import type { Market } from '$lib/types/market';

	interface Props {
		market: Market;
	}

	const { market }: Props = $props();

	/**
	 * Human label for the winning outcome. For binary markets the outcome id
	 * (`YES` / `NO`) is already friendly; for categorical markets we look up
	 * the outcome title by id to avoid surfacing an opaque slug.
	 */
	const winnerLabel = $derived.by(() => {
		if (!nonNullish(market.outcome)) {
			return;
		}

		if (market.payoffType === 'Binary') {
			return market.outcome;
		}

		const hit = market.outcomes?.find((o) => o.id === market.outcome);

		return hit?.title ?? market.outcome;
	});

	const isWin = $derived(market.outcome === 'YES');
	const isLoss = $derived(market.outcome === 'NO');
	const isCanceled = $derived(market.outcome === 'CANCELED');
</script>

<div
	class="relative overflow-hidden rounded-3xl border p-8 shadow-sm {isWin
		? 'border-emerald-200 bg-emerald-50'
		: isLoss
			? 'border-rose-200 bg-rose-50'
			: isCanceled
				? 'border-amber-200 bg-amber-50'
				: 'border-slate-200 bg-white'}"
>
	<div class="flex flex-col items-center gap-4 text-center">
		<div
			class="flex h-12 w-12 items-center justify-center rounded-full {isWin
				? 'bg-emerald-500 text-white'
				: isLoss
					? 'bg-rose-500 text-white'
					: isCanceled
						? 'bg-amber-500 text-white'
						: 'bg-slate-500 text-white'}"
		>
			<CheckCircle2 size={24} />
		</div>

		<div class="space-y-1">
			<p class="text-[10px] font-black tracking-widest text-slate-400 uppercase">Market Resolved</p>
			{#if nonNullish(winnerLabel)}
				<h3 class="font-serif text-3xl font-black text-slate-950 sm:text-4xl">
					{#if isCanceled}
						Canceled
					{:else}
						Winner: <span
							class={isWin ? 'text-emerald-600' : isLoss ? 'text-rose-600' : 'text-indigo-600'}
						>
							{winnerLabel}
						</span>
					{/if}
				</h3>
			{:else}
				<h3 class="font-serif text-2xl font-black text-slate-950">Settled</h3>
			{/if}
			<p class="text-sm text-slate-500">
				Trading is closed. Settled payouts have been applied to every holder's balance.
			</p>
		</div>
	</div>
</div>
