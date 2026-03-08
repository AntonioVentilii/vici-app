<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { getLeaderboard } from '$lib/services/social.services';
	import type { LeaderboardEntry } from '$lib/types/social';

	let leaderboard = $state<LeaderboardEntry[]>([]);

	let loading = $state(true);

	onMount(async () => {
		loading = true;
		try {
			leaderboard = await getLeaderboard();
		} finally {
			loading = false;
		}
	});

	const getPodiumColor = (rank: number) => {
		switch (rank) {
			case 1:
				return 'from-yellow-400 to-yellow-600';
			case 2:
				return 'from-slate-300 to-slate-500';
			case 3:
				return 'from-amber-600 to-amber-800';
			default:
				return 'from-slate-700 to-slate-900';
		}
	};
</script>

<div class="flex flex-col gap-6">
	{#if loading}
		<div class="flex justify-center py-8">
			<LoadingSpinner />
		</div>
	{:else}
		<!-- Podium -->
		<div class="flex items-end justify-center gap-3 pt-8">
			{#each [2, 1, 3] as rank (rank)}
				{@const entry = leaderboard.find((e) => e.rank === rank)}

				{#if entry}
					<div class="flex flex-col items-center gap-1.5">
						<div class="relative">
							<div
								class="bg-muted h-12 w-12 overflow-hidden rounded-full border-2 border-white/10 shadow-xl {rank ===
								1
									? 'h-16 w-16'
									: ''}"
							>
								<div class="flex h-full w-full items-center justify-center text-lg font-bold">
									{entry.user[0]}
								</div>
							</div>
							<div
								class="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br shadow-lg {getPodiumColor(
									rank
								)}"
							>
								<span class="text-[10px] font-black text-white">{rank}</span>
							</div>
						</div>
						<div class="text-center">
							<p class="w-20 truncate text-xs font-bold">{entry.user}</p>
							<p class="text-primary text-[10px] font-black">+{entry.pnl.toFixed(0)}</p>
						</div>
						<div
							style="height: {rank === 1 ? '70px' : rank === 2 ? '50px' : '35px'}"
							class="bg-linear-to-t {getPodiumColor(rank)} w-16 rounded-t-xl opacity-80 shadow-2xl"
						></div>
					</div>
				{/if}
			{/each}
		</div>

		<!-- List -->
		<Card padding="none" variant="glass">
			<div class="flex flex-col">
				{#each leaderboard.slice(3) as entry (entry.rank)}
					<div
						class="flex items-center gap-3 border-b border-white/5 px-4 py-3 font-medium transition-colors last:border-0 hover:bg-white/5"
					>
						<span class="text-muted-foreground w-5 text-[10px]">#{entry.rank}</span>
						<div class="bg-muted flex h-7 w-7 items-center justify-center rounded-full text-[10px]">
							{entry.user[0]}
						</div>
						<span class="flex-1 truncate text-xs">{entry.user}</span>
						<div class="text-right">
							<p class="text-xs font-bold">+{entry.pnl.toFixed(0)}</p>
							<p class="text-muted-foreground text-[8px] opacity-50">{entry.winRate}% SR</p>
						</div>
					</div>
				{/each}
			</div>
		</Card>
	{/if}
</div>
