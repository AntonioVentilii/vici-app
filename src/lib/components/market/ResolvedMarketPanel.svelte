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
	class="relative overflow-hidden rounded-3xl border p-8 {isWin
		? 'border-yes/20 bg-yes-wash'
		: isLoss
			? 'border-destructive/20 bg-destructive/10'
			: isCanceled
				? 'border-primary/20 bg-primary/10'
				: 'border-border bg-card'}"
>
	<div class="flex flex-col items-center gap-4 text-center">
		<div
			class="flex h-12 w-12 items-center justify-center rounded-full {isWin
				? 'bg-yes text-white'
				: isLoss
					? 'bg-destructive text-white'
					: isCanceled
						? 'bg-primary text-white'
						: 'bg-muted-foreground text-white'}"
		>
			<CheckCircle2 size={24} />
		</div>

		<div class="space-y-1">
			<p class="text-muted-foreground text-[10px] font-black tracking-widest uppercase">
				Market Resolved
			</p>
			{#if nonNullish(winnerLabel)}
				<h3 class="text-foreground font-serif text-3xl font-black sm:text-4xl">
					{#if isCanceled}
						Canceled
					{:else}
						Winner: <span class={isWin ? 'text-yes' : isLoss ? 'text-destructive' : 'text-primary'}>
							{winnerLabel}
						</span>
					{/if}
				</h3>
			{:else}
				<h3 class="text-foreground font-serif text-2xl font-black">Settled</h3>
			{/if}
			<p class="text-muted-foreground text-sm">
				Trading is closed. Settled payouts have been applied to every holder's balance.
			</p>
		</div>
	</div>
</div>
