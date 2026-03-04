<script lang="ts">
	import Leaderboard from '$lib/components/social/Leaderboard.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	// Leaderboard component handles fetching logic now
</script>

<div class="space-y-12">
	<SectionHeader
		description="Compete with the best predictors in the community. Rankings are updated in real-time based on total P&L and win rate."
		highlight="Leaderboard"
		title="Global"
	/>

	<!-- Global Leaderboard -->
	<Leaderboard />

	<!-- Info Card -->
	<div
		class="flex flex-col items-center justify-between gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm md:flex-row"
	>
		<div class="space-y-2">
			<h3 class="text-center text-xl font-bold text-slate-950 md:text-left">
				How is P&L calculated?
			</h3>
			<p class="text-center text-sm text-slate-600 md:text-left">
				Profit and Loss is calculated based on the difference between your entry odds and the
				current market probability (unrealized) or the final resolution (realized).
			</p>
		</div>
		<button
			class="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-bold whitespace-nowrap text-white shadow-lg shadow-indigo-500/20 transition-transform hover:scale-105 active:scale-95"
		>
			View My Stats
		</button>
	</div>
</div>
