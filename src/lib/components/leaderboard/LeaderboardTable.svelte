<script lang="ts">
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import PrincipalText from '$lib/components/ui/PrincipalText.svelte';
	import type { LeaderboardEntry } from '$lib/types/social';

	interface Props {
		leaderboard: LeaderboardEntry[];
		loading: boolean;
	}

	const { leaderboard, loading }: Props = $props();
</script>

<div class="border-border bg-card overflow-hidden rounded-lg border">
	{#if loading}
		<LoadingSpinner />
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-left">
				<thead>
					<tr
						class="border-border text-muted-foreground bg-card border-b text-[10px] tracking-[0.2em] uppercase"
					>
						<th class="px-8 py-5 font-black">Rank</th>
						<th class="px-8 py-5 font-black">User / Principal</th>
						<th class="px-8 py-5 text-right font-black">Active Positions</th>
						<th class="px-8 py-5 text-right font-black">Win Rate</th>
						<th class="px-8 py-5 text-right font-black">Total P&L</th>
					</tr>
				</thead>
				<tbody class="divide-border divide-y">
					{#each leaderboard as entry, index (index)}
						<tr class="group hover:bg-card transition-colors">
							<td class="px-8 py-6">
								<div
									class="flex h-10 w-10 items-center justify-center rounded-lg font-mono font-black {entry.rank ===
									1
										? 'border-primary/30 bg-primary/15 text-primary border'
										: entry.rank === 2
											? 'border-muted-foreground/30 bg-muted-foreground/10 text-muted-foreground border'
											: entry.rank === 3
												? 'border border-[#CD7F32]/30 bg-[#CD7F32]/10 text-[#CD7F32]'
												: 'border-border text-muted-foreground bg-card border'}"
								>
									#{entry.rank}
								</div>
							</td>
							<td class="px-8 py-6">
								<div class="flex items-center gap-3">
									<div
										class="from-primary to-primary/60 h-10 w-10 rounded-full bg-linear-to-br p-px"
									>
										<div
											class="bg-card text-primary flex h-full w-full items-center justify-center rounded-full text-[10px] font-bold"
										>
											{entry.user.substring(0, 2).toUpperCase()}
										</div>
									</div>
									<span
										class="text-muted-foreground group-hover:text-foreground text-sm transition-colors"
									>
										<PrincipalText principal={entry.user} />
									</span>
								</div>
							</td>
							<td class="text-foreground px-8 py-6 text-right font-mono font-bold tabular-nums"
								>{entry.activePositions}</td
							>
							<td class="text-foreground px-8 py-6 text-right font-mono font-bold tabular-nums"
								>{entry.winRate}%</td
							>
							<td class="px-8 py-6 text-right">
								<span class="text-yes font-mono text-lg font-black tabular-nums">
									+{entry.pnl.toFixed(1)}
									<span class="text-xs uppercase opacity-60">ICP</span>
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
