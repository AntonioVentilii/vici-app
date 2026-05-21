<script lang="ts">
	import type { Outcome } from '$lib/types/market';
	import { formatProbability } from '$lib/utils/format.utils';

	interface Props {
		yesProbability: number;
		noProbability: number;
		winningOutcome?: Outcome;
	}

	const { yesProbability, noProbability, winningOutcome }: Props = $props();

	const yesWon = $derived(winningOutcome === 'YES');
	const noWon = $derived(winningOutcome === 'NO');
	const isResolved = $derived(yesWon || noWon);
</script>

<div
	class="relative flex flex-col items-center rounded-xl border p-3 transition-colors {isResolved
		? noWon
			? 'border-no/30 bg-no-wash'
			: 'border-border bg-card opacity-60'
		: 'border-no/20 bg-no-wash hover:bg-no/15'}"
>
	<div
		class="mb-1 text-[10px] font-bold tracking-widest uppercase {isResolved && !noWon
			? 'text-muted-foreground line-through'
			: 'text-no'}"
	>
		No{#if noWon}
			✓{/if}
	</div>
	<div
		class="num text-lg font-black tabular-nums sm:text-xl {isResolved && !noWon
			? 'text-muted-foreground line-through'
			: 'text-no'}"
	>
		{isResolved ? (noWon ? '100%' : '0%') : formatProbability(noProbability)}
	</div>
</div>

<div
	class="relative flex flex-col items-center rounded-xl border p-3 transition-colors {isResolved
		? yesWon
			? 'border-yes/30 bg-yes-wash'
			: 'border-border bg-card opacity-60'
		: 'border-yes/20 bg-yes-wash hover:bg-yes/15'}"
>
	<div
		class="mb-1 text-[10px] font-bold tracking-widest uppercase {isResolved && !yesWon
			? 'text-muted-foreground line-through'
			: 'text-yes'}"
	>
		Yes{#if yesWon}
			✓{/if}
	</div>
	<div
		class="num text-lg font-black tabular-nums sm:text-xl {isResolved && !yesWon
			? 'text-muted-foreground line-through'
			: 'text-yes'}"
	>
		{isResolved ? (yesWon ? '100%' : '0%') : formatProbability(yesProbability)}
	</div>
</div>
