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
				? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
				: 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-950'}"
			onclick={() => onTimeframeChange(timeframe)}
		>
			{timeframe}
		</button>
	{/each}
</div>
