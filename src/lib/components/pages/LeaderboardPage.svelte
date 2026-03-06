<script lang="ts">
	import Leaderboard from '$lib/components/social/Leaderboard.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	// Leaderboard component handles fetching logic now
</script>

<div class="space-y-8">
	<SectionHeader
		description="Compete with the best predictors. Rankings updated in real-time."
		highlight="Leaderboard"
		title="Global"
	/>

	<!-- Global Leaderboard -->
	<Leaderboard />

	<!-- Info Card -->
	<div
		class="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row"
	>
		<div class="space-y-1">
			<h3 class="text-center text-lg font-bold text-slate-950 md:text-left">
				How is P&L calculated?
			</h3>
			<p class="text-center text-xs text-slate-600 md:text-left">
				Profit and Loss is based on the difference between entry odds and the current probability or
				final resolution.
			</p>
		</div>
		<button
			class="rounded-lg bg-indigo-600 px-6 py-2.5 text-xs font-bold whitespace-nowrap text-white shadow-lg shadow-indigo-500/20 transition-transform hover:scale-105 active:scale-95"
		>
			View My Stats
		</button>
	</div>
</div>
