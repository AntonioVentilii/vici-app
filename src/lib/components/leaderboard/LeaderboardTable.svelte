<script lang="ts">
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import type { LeaderboardEntry } from '$lib/services/mockBackend';

	interface Props {
		leaderboard: LeaderboardEntry[];
		loading: boolean;
	}

	const { leaderboard, loading }: Props = $props();
</script>

<div class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
	{#if loading}
		<LoadingSpinner />
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-left">
				<thead>
					<tr
						class="border-b border-slate-100 bg-slate-50 text-[10px] tracking-[0.2em] text-slate-500 uppercase"
					>
						<th class="px-8 py-5 font-black">Rank</th>
						<th class="px-8 py-5 font-black">User / Principal</th>
						<th class="px-8 py-5 text-right font-black">Active Positions</th>
						<th class="px-8 py-5 text-right font-black">Win Rate</th>
						<th class="px-8 py-5 text-right font-black">Total P&L</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50">
					{#each leaderboard as entry, index (index)}
						<tr class="group transition-colors hover:bg-slate-50/50">
							<td class="px-8 py-6">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-xl font-black {entry.rank ===
									1
										? 'border border-yellow-200 bg-yellow-100 text-yellow-700 shadow-sm'
										: entry.rank === 2
											? 'border border-slate-200 bg-slate-100 text-slate-700'
											: entry.rank === 3
												? 'border border-amber-200 bg-amber-100 text-amber-700'
												: 'border border-slate-100 bg-slate-50 text-slate-500'}"
								>
									#{entry.rank}
								</div>
							</td>
							<td class="px-8 py-6">
								<div class="flex items-center gap-3">
									<div
										class="h-10 w-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 p-px"
									>
										<div
											class="flex h-full w-full items-center justify-center rounded-full bg-white text-[10px] font-bold text-indigo-600"
										>
											{entry.user.substring(0, 2).toUpperCase()}
										</div>
									</div>
									<span
										class="font-mono text-sm text-slate-600 transition-colors group-hover:text-slate-950"
										>{entry.user}</span
									>
								</div>
							</td>
							<td class="px-8 py-6 text-right font-bold text-slate-950">{entry.activePositions}</td>
							<td class="px-8 py-6 text-right font-bold text-slate-950">{entry.winRate}%</td>
							<td class="px-8 py-6 text-right">
								<span class="text-lg font-black text-green-600"
									>+{entry.pnl.toFixed(1)}
									<span class="text-xs uppercase opacity-60">ICP</span></span
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
