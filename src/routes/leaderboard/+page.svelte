<script lang="ts">
	import { onMount } from 'svelte';
	import LeaderboardTable from '$lib/components/leaderboard/LeaderboardTable.svelte';
	import LeaderboardTimeframes from '$lib/components/leaderboard/LeaderboardTimeframes.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { mockBackend, type LeaderboardEntry } from '$lib/services/mockBackend';

	let leaderboard = $state<LeaderboardEntry[]>([]);
	let loading = $state(true);
	let activeTimeframe = $state('All-time');

	const timeframes = ['Weekly', 'Monthly', 'All-time'];

	onMount(async () => {
		leaderboard = await mockBackend.getLeaderboard();
		loading = false;
	});
</script>

<div class="space-y-12">
	<SectionHeader
		description="Compete with the best predictors in the community. Rankings are updated in real-time based on total P&L and win rate."
		highlight="Leaderboard"
		title="Global"
	/>

	<!-- Timeframe Filters -->
	<LeaderboardTimeframes
		{activeTimeframe}
		onTimeframeChange={(timeframe) => (activeTimeframe = timeframe)}
		{timeframes}
	/>

	<!-- Leaderboard Table -->
	<LeaderboardTable {leaderboard} {loading} />

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
