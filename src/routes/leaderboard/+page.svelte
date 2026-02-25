<script lang="ts">
	import { onMount } from 'svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
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
	<div class="flex gap-2">
		{#each timeframes as timeframe (timeframe)}
			<button
				class="rounded-xl px-6 py-2.5 text-sm font-bold transition-all {activeTimeframe ===
				timeframe
					? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
					: 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}"
				onclick={() => (activeTimeframe = timeframe)}
			>
				{timeframe}
			</button>
		{/each}
	</div>

	<!-- Leaderboard Table -->
	<div class="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
		{#if loading}
			<LoadingSpinner />
		{:else}
			<table class="w-full text-left">
				<thead>
					<tr
						class="border-b border-white/10 bg-white/5 text-[10px] tracking-[0.2em] text-gray-500 uppercase"
					>
						<th class="px-8 py-5 font-black">Rank</th>
						<th class="px-8 py-5 font-black">User / Principal</th>
						<th class="px-8 py-5 text-right font-black">Active Positions</th>
						<th class="px-8 py-5 text-right font-black">Win Rate</th>
						<th class="px-8 py-5 text-right font-black">Total P&L</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-white/5">
					{#each leaderboard as entry, index (index)}
						<tr class="group transition-colors hover:bg-white/5">
							<td class="px-8 py-6">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-xl font-black {entry.rank ===
									1
										? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]'
										: entry.rank === 2
											? 'bg-gray-300 text-black'
											: entry.rank === 3
												? 'bg-amber-600 text-white'
												: 'bg-white/5 text-gray-400'}"
								>
									#{entry.rank}
								</div>
							</td>
							<td class="px-8 py-6">
								<div class="flex items-center gap-3">
									<div
										class="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[1px]"
									>
										<div
											class="flex h-full w-full items-center justify-center rounded-full bg-black text-[10px] font-bold text-white"
										>
											{entry.user.substring(0, 2).toUpperCase()}
										</div>
									</div>
									<span
										class="font-mono text-sm text-gray-300 transition-colors group-hover:text-white"
										>{entry.user}</span
									>
								</div>
							</td>
							<td class="px-8 py-6 text-right font-bold text-white">{entry.activePositions}</td>
							<td class="px-8 py-6 text-right font-bold text-white">{entry.winRate}%</td>
							<td class="px-8 py-6 text-right">
								<span class="text-lg font-black text-green-400"
									>+{entry.pnl.toFixed(1)}
									<span class="text-xs uppercase opacity-60">ICP</span></span
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<!-- Info Card -->
	<div
		class="flex flex-col items-center justify-between gap-6 rounded-3xl border border-white/10 bg-gradient-to-r from-indigo-500/10 to-purple-600/10 p-8 md:flex-row"
	>
		<div class="space-y-2">
			<h3 class="text-center text-xl font-bold text-white md:text-left">How is P&L calculated?</h3>
			<p class="text-center text-sm text-gray-400 md:text-left">
				Profit and Loss is calculated based on the difference between your entry odds and the
				current market probability (unrealized) or the final resolution (realized).
			</p>
		</div>
		<button
			class="rounded-xl bg-white px-8 py-3 text-sm font-bold whitespace-nowrap text-black transition-transform hover:scale-105 active:scale-95"
		>
			View My Stats
		</button>
	</div>
</div>
