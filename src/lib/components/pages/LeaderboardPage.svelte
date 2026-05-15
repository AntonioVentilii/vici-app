<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import YouBadge from '$lib/components/ui/YouBadge.svelte';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { getLeaderboard } from '$lib/services/leaderboard.services';
	import type { UserProfile } from '$lib/types/profile';

	let loading = $state(true);
	let leaderboard = $state<UserProfile[]>([]);
	const currentUser = $authPrincipal;

	let intervalId: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		const fetchLeaderboard = async () => {
			try {
				const data = await getLeaderboard(50);
				leaderboard = data;
			} finally {
				loading = false;
			}
		};

		fetchLeaderboard();
		intervalId = setInterval(fetchLeaderboard, 30000);

		return () => clearInterval(intervalId);
	});

	let podium = $derived(leaderboard.slice(0, 3));
	let rest = $derived(leaderboard.slice(3));

	// Reorder podium to [2nd, 1st, 3rd] for display
	let displayPodium = $derived.by(() => {
		if (podium.length === 0) {
			return [];
		}

		if (podium.length === 1) {
			return [podium[0]];
		}

		if (podium.length === 2) {
			return [podium[1], podium[0]];
		}

		return [podium[1], podium[0], podium[2]];
	});

	const getPodiumStyle = (indexInDisplay: number) => {
		const isFirst =
			(podium.length >= 2 && indexInDisplay === 1) || (podium.length === 1 && indexInDisplay === 0);

		if (isFirst) {
			return 'h-40 w-40 sm:h-48 sm:w-48 -mt-8 border-primary ring-primary/20 ring-8 shadow-2xl z-20 scale-110';
		}

		if (indexInDisplay === 0) {
			return 'h-28 w-28 sm:h-36 sm:w-36 border-muted-foreground/40 ring-muted-foreground/10 ring-4 opacity-100';
		}

		return 'h-24 w-24 sm:h-32 sm:w-32 border-[#CD7F32] ring-[#CD7F32]/10 ring-4 opacity-90';
	};

	const getMedalEmoji = (indexInDisplay: number) => {
		const isFirst =
			(podium.length >= 2 && indexInDisplay === 1) || (podium.length === 1 && indexInDisplay === 0);

		if (isFirst) {
			return '🥇';
		}

		if (indexInDisplay === 0) {
			return '🥈';
		}

		return '🥉';
	};
</script>

<div class="space-y-12 pb-24">
	<SectionHeader
		description="Compete with the world's most accurate predictors."
		highlight="Leaderboard"
		title="Global"
	/>

	{#if loading}
		<div class="flex flex-col items-center justify-center space-y-4 py-24">
			<div
				class="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
			></div>
			<p class="text-muted-foreground animate-pulse text-xs font-bold tracking-widest uppercase">
				Calculating Alphas...
			</p>
		</div>
	{:else}
		<!-- The Podium Section -->
		<div class="flex min-h-75 flex-row items-end justify-center gap-1 px-4 sm:gap-8">
			{#each displayPodium as user, i (user.owner)}
				<div
					class="flex flex-col items-center gap-4 transition-all hover:-translate-y-1"
					in:fly={{ y: 50, delay: i * 200 }}
				>
					<div class="relative">
						<Avatar
							class="bg-card border-4 shadow-xl {getPodiumStyle(i)}"
							avatar={user.avatar}
							nickname={user.nickname}
							owner={user.owner}
						/>
						<div
							class="absolute -top-4 -right-1 text-3xl shadow-sm drop-shadow-md sm:-right-2 sm:text-4xl"
						>
							{getMedalEmoji(i)}
						</div>
					</div>
					<div class="max-w-25 text-center sm:max-w-none">
						<div class="flex items-center justify-center gap-1.5">
							<h3 class="text-foreground truncate text-sm font-black sm:text-lg">
								{user.nickname}
							</h3>
							{#if user.owner === currentUser}
								<YouBadge />
							{/if}
						</div>
						<p
							class="text-primary font-mono text-[10px] font-bold tracking-tighter uppercase sm:text-xs"
						>
							{Math.floor(user.points ?? 0)} XP
						</p>
					</div>
				</div>
			{/each}
		</div>

		<!-- The Detailed List -->
		<div class="mx-auto max-w-2xl space-y-2 px-4 pt-8">
			{#each rest as user, i (user.owner)}
				<div
					class="group border-border bg-card hover:border-primary/30 flex items-center justify-between rounded-lg border p-3 transition-all sm:p-4 {user.owner ===
					currentUser
						? 'border-primary/50 bg-primary/5'
						: ''}"
					in:fade={{ delay: i * 30 }}
				>
					<div class="flex items-center gap-4 sm:gap-6">
						<span
							class="text-muted-foreground w-6 text-center font-mono text-xs font-black sm:w-8 sm:text-sm"
						>
							#{i + 4}
						</span>
						<Avatar
							class="ring-border bg-card h-8 w-8 shadow-inner ring-2 sm:h-10 sm:w-10"
							avatar={user.avatar}
							nickname={user.nickname}
							owner={user.owner}
						/>
						<div class="min-w-0">
							<div class="flex items-center gap-1.5">
								<p
									class="text-foreground max-w-30 truncate text-xs font-bold sm:max-w-none sm:text-sm"
								>
									{user.nickname}
								</p>
								{#if user.owner === currentUser}
									<YouBadge />
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<span class="text-muted-foreground font-mono text-[9px] font-bold uppercase">
									Streak: {user.dailyStreak ?? 1}d
								</span>
								<span class="text-border text-[9px]">•</span>
								<span class="text-yes font-mono text-[9px] font-bold uppercase">
									{Math.round(user.accuracy ?? 0)}% ACC
								</span>
							</div>
						</div>
					</div>
					<div class="flex flex-col items-end text-right">
						<p class="text-foreground font-mono text-xs font-black tabular-nums sm:text-sm">
							{Math.floor(user.points ?? 0)}
						</p>
						<p class="text-muted-foreground text-[9px] leading-none font-bold uppercase">XP</p>
					</div>
				</div>
			{:else}
				{#if !loading && rest.length === 0}
					<div class="py-12 text-center">
						<p class="text-sm font-black text-muted-foreground uppercase tracking-widest">
							Joining the pack...
						</p>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
