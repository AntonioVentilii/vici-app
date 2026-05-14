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
	class="relative flex flex-col items-center rounded-2xl border p-4 transition-colors {isResolved
		? noWon
			? 'border-[var(--no)]/30 bg-[var(--no-wash)]'
			: 'border-border bg-card opacity-60'
		: 'border-[var(--no)]/20 bg-[var(--no-wash)] hover:bg-[var(--no)]/15'}"
>
	<div
		class="mb-1 text-[10px] font-bold tracking-widest uppercase {isResolved && !noWon
			? 'text-muted-foreground line-through'
			: 'text-[var(--no)]'}"
	>
		No{#if noWon}
			✓{/if}
	</div>
	<div
		class="font-mono text-2xl font-black tabular-nums {isResolved && !noWon
			? 'text-muted-foreground line-through'
			: 'text-[var(--no)]'}"
	>
		{isResolved ? (noWon ? '100%' : '0%') : formatProbability(noProbability)}
	</div>
</div>

<div
	class="relative flex flex-col items-center rounded-2xl border p-4 transition-colors {isResolved
		? yesWon
			? 'border-[var(--yes)]/30 bg-[var(--yes-wash)]'
			: 'border-border bg-card opacity-60'
		: 'border-[var(--yes)]/20 bg-[var(--yes-wash)] hover:bg-[var(--yes)]/15'}"
>
	<div
		class="mb-1 text-[10px] font-bold tracking-widest uppercase {isResolved && !yesWon
			? 'text-muted-foreground line-through'
			: 'text-[var(--yes)]'}"
	>
		Yes{#if yesWon}
			✓{/if}
	</div>
	<div
		class="font-mono text-2xl font-black tabular-nums {isResolved && !yesWon
			? 'text-muted-foreground line-through'
			: 'text-[var(--yes)]'}"
	>
		{isResolved ? (yesWon ? '100%' : '0%') : formatProbability(yesProbability)}
	</div>
</div>
