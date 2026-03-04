<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { socialService } from '$lib/services/social.services';
	import type { LeaderboardEntry } from '$lib/types/social';

	let leaderboard: LeaderboardEntry[] = $state([]);
	let loading = $state(true);

	onMount(async () => {
		loading = true;
		try {
			leaderboard = await socialService.getLeaderboard();
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

<div class="flex flex-col gap-8">
	{#if loading}
		<div class="flex justify-center py-12">
			<LoadingSpinner />
		</div>
	{:else}
		<!-- Podium -->
		<div class="flex items-end justify-center gap-4 pt-12">
			{#each [2, 1, 3] as rank (rank)}
				{@const entry = leaderboard.find((e) => e.rank === rank)}
				{#if entry}
					<div class="flex flex-col items-center gap-2">
						<div class="relative">
							<div
								class="bg-muted h-16 w-16 overflow-hidden rounded-full border-4 border-white/10 shadow-xl {rank ===
								1
									? 'h-20 w-20'
									: ''}"
							>
								<div class="flex h-full w-full items-center justify-center text-xl font-bold">
									{entry.user[0]}
								</div>
							</div>
							<div
								class="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br shadow-lg {getPodiumColor(
									rank
								)}"
							>
								<span class="text-xs font-black text-white">{rank}</span>
							</div>
						</div>
						<div class="text-center">
							<p class="w-24 truncate text-sm font-bold">{entry.user}</p>
							<p class="text-primary text-xs font-black">+{entry.pnl.toFixed(0)}</p>
						</div>
						<div
							style="height: {rank === 1 ? '100px' : rank === 2 ? '70px' : '50px'}"
							class="bg-linear-to-t {getPodiumColor(rank)} w-20 rounded-t-2xl opacity-80 shadow-2xl"
						></div>
					</div>
				{/if}
			{/each}
		</div>

		<!-- List -->
		<Card class="glassmorphism overflow-hidden">
			<div class="flex flex-col">
				{#each leaderboard.slice(3) as entry (entry.rank)}
					<div
						class="flex items-center gap-4 border-b border-white/5 p-4 font-medium transition-colors last:border-0 hover:bg-white/5"
					>
						<span class="text-muted-foreground w-6 text-sm">#{entry.rank}</span>
						<div class="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-xs">
							{entry.user[0]}
						</div>
						<span class="flex-1 truncate text-sm">{entry.user}</span>
						<div class="text-right">
							<p class="text-sm font-bold">+{entry.pnl.toFixed(0)}</p>
							<p class="text-muted-foreground text-[10px] opacity-50">{entry.winRate}% SR</p>
						</div>
					</div>
				{/each}
			</div>
		</Card>
	{/if}
</div>

<style lang="postcss">
	.glassmorphism {
		background: rgba(255, 255, 255, 0.03);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}
</style>
