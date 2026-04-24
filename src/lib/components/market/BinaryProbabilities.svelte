<script lang="ts">
	import { formatProbability } from '$lib/utils/format.utils';
	import type { Outcome } from '$lib/types/market';

	interface Props {
		yesProbability: number;
		noProbability: number;
		/**
		 * When set, the market has resolved and we want the winning/losing side
		 * to be visually distinguished instead of showing live probabilities.
		 */
		winningOutcome?: Outcome;
	}

	const { yesProbability, noProbability, winningOutcome }: Props = $props();

	const yesWon = $derived(winningOutcome === 'YES');
	const noWon = $derived(winningOutcome === 'NO');
	const isResolved = $derived(yesWon || noWon);
</script>

<div
	class="relative flex flex-col items-center rounded-2xl border p-4 transition-colors {isResolved
		? noWon
			? 'border-destructive/30 bg-destructive/10'
			: 'border-slate-200 bg-slate-50 opacity-60'
		: 'border-destructive/20 bg-destructive/5 hover:bg-destructive/10'}"
>
	<div
		class="mb-1 text-[10px] font-bold tracking-widest uppercase {isResolved && !noWon
			? 'text-slate-400 line-through'
			: 'text-destructive'}"
	>
		No{#if noWon}{' '}✓{/if}
	</div>
	<div
		class="font-serif text-2xl font-black {isResolved && !noWon
			? 'text-slate-400 line-through'
			: 'text-destructive'}"
	>
		{isResolved ? (noWon ? '100%' : '0%') : formatProbability(noProbability)}
	</div>
</div>

<div
	class="relative flex flex-col items-center rounded-2xl border p-4 transition-colors {isResolved
		? yesWon
			? 'border-success/30 bg-success/10'
			: 'border-slate-200 bg-slate-50 opacity-60'
		: 'border-success/20 bg-success/5 hover:bg-success/10'}"
>
	<div
		class="mb-1 text-[10px] font-bold tracking-widest uppercase {isResolved && !yesWon
			? 'text-slate-400 line-through'
			: 'text-success'}"
	>
		Yes{#if yesWon}{' '}✓{/if}
	</div>
	<div
		class="font-serif text-2xl font-black {isResolved && !yesWon
			? 'text-slate-400 line-through'
			: 'text-success'}"
	>
		{isResolved ? (yesWon ? '100%' : '0%') : formatProbability(yesProbability)}
	</div>
</div>
