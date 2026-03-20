<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
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
			return 'h-40 w-40 sm:h-48 sm:w-48 -mt-8 border-amber-400 ring-amber-100 ring-8 shadow-2xl z-20 scale-110';
		}
		if (indexInDisplay === 0) {
			return 'h-28 w-28 sm:h-36 sm:w-36 border-slate-300 ring-slate-100 ring-4 opacity-100';
		}
		return 'h-24 w-24 sm:h-32 sm:w-32 border-orange-300 ring-orange-100 ring-4 opacity-90';
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
				class="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-sm"
			></div>
			<p class="animate-pulse text-xs font-bold tracking-widest text-slate-400 uppercase">
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
						<div
							class="overflow-hidden rounded-full border-4 bg-white shadow-xl {getPodiumStyle(i)}"
						>
							{#if user.avatar}
								<img class="h-full w-full object-cover" alt={user.nickname} src={user.avatar} />
							{:else}
								<div
									class="flex h-full w-full items-center justify-center bg-slate-50 text-4xl font-black text-slate-200"
								>
									{user.nickname[0]}
								</div>
							{/if}
						</div>
						<div
							class="absolute -top-4 -right-1 text-3xl shadow-sm drop-shadow-md sm:-right-2 sm:text-4xl"
						>
							{getMedalEmoji(i)}
						</div>
					</div>
					<div class="max-w-25 text-center sm:max-w-none">
						<h3 class="truncate text-sm font-black text-slate-950 sm:text-lg">{user.nickname}</h3>
						<p class="text-[10px] font-bold tracking-tighter text-indigo-600 uppercase sm:text-xs">
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
					class="group flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md hover:ring-indigo-200 sm:p-4 {user.owner ===
					currentUser
						? 'bg-indigo-50/10 ring-2 ring-indigo-500'
						: ''}"
					in:fade={{ delay: i * 30 }}
				>
					<div class="flex items-center gap-4 sm:gap-6">
						<span class="w-6 text-center text-xs font-black text-slate-300 sm:w-8 sm:text-sm"
							>#{i + 4}</span
						>
						<div
							class="h-8 w-8 overflow-hidden rounded-full bg-slate-100 shadow-inner ring-2 ring-white sm:h-10 sm:w-10"
						>
							{#if user.avatar}
								<img class="h-full w-full object-cover" alt={user.nickname} src={user.avatar} />
							{:else}
								<div
									class="flex h-full w-full items-center justify-center text-[10px] font-black text-slate-400"
								>
									{user.nickname[0]}
								</div>
							{/if}
						</div>
						<div class="min-w-0">
							<p
								class="max-w-30 truncate text-xs font-bold text-slate-950 sm:max-w-none sm:text-sm"
							>
								{user.nickname}
							</p>
							<div class="flex items-center gap-2">
								<span class="text-[9px] font-bold text-slate-400 uppercase"
									>Streak: {user.dailyStreak ?? 1}d</span
								>
								<span class="text-[9px] text-slate-200">•</span>
								<span class="text-[9px] font-bold text-emerald-500 uppercase"
									>{Math.round(user.accuracy ?? 0)}% ACC</span
								>
							</div>
						</div>
					</div>
					<div class="flex flex-col items-end text-right">
						<p class="text-xs font-black text-slate-950 sm:text-sm">
							{Math.floor(user.points ?? 0)}
						</p>
						<p class="text-[9px] leading-none font-bold text-slate-400 uppercase">XP</p>
					</div>
				</div>
			{:else}
				{#if !loading && rest.length === 0}
					<div class="py-12 text-center">
						<p class="text-sm font-black text-slate-300 uppercase tracking-widest">
							Joining the pack...
						</p>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>
