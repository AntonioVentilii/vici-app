<script lang="ts">
	interface Props {
		timeframes: string[];
		activeTimeframe: string;
		onTimeframeChange: (timeframe: string) => void;
	}

	const { timeframes, activeTimeframe, onTimeframeChange }: Props = $props();
</script>

<div class="flex gap-2">
	{#each timeframes as timeframe (timeframe)}
		<button
			class="rounded-xl px-6 py-2.5 text-sm font-bold transition-all {activeTimeframe === timeframe
				? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
				: 'bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground'}"
			onclick={() => onTimeframeChange(timeframe)}
		>
			{timeframe}
		</button>
	{/each}
</div>
