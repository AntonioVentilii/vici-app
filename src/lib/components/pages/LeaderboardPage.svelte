<script lang="ts">
	import { Users } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import Avatar from '$lib/components/profile/Avatar.svelte';
	import ActivityFeed from '$lib/components/social/ActivityFeed.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import YouBadge from '$lib/components/ui/YouBadge.svelte';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { getLeaderboard } from '$lib/services/leaderboard.services';
	import { getFollowing } from '$lib/services/relation.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { UserProfile } from '$lib/types/profile';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	type SocialTab = 'global' | 'week' | 'friends' | 'activity';

	const socialTabs: { id: SocialTab; labelKey: MessageKey }[] = [
		{ id: 'global', labelKey: 'leaderboard.tab.global' },
		{ id: 'week', labelKey: 'leaderboard.tab.week' },
		{ id: 'friends', labelKey: 'leaderboard.tab.friends' },
		{ id: 'activity', labelKey: 'leaderboard.tab.activity' }
	];

	let loading = $state(true);
	let leaderboard = $state<UserProfile[]>([]);
	let following = $state<string[]>([]);
	let activeTab = $state<SocialTab>('global');
	const currentUser = $derived($authPrincipal);

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

		const fetchFollowing = async () => {
			if (!currentUser) {
				following = [];

				return;
			}

			following = await getFollowing().catch(() => []);
		};

		fetchLeaderboard();
		fetchFollowing();
		intervalId = setInterval(fetchLeaderboard, 30000);

		return () => clearInterval(intervalId);
	});

	let rankedUsers = $derived.by(() => {
		if (activeTab !== 'friends') {
			return leaderboard;
		}

		const friendSet = new Set([currentUser, ...following].filter(Boolean));

		return leaderboard.filter((user) => friendSet.has(user.owner));
	});

	let podium = $derived(rankedUsers.slice(0, 3));
	let rest = $derived(rankedUsers.slice(3));

	// Podium order keeps #1 centered.
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

	const globalRank = (user: UserProfile) =>
		leaderboard.findIndex((ranked) => ranked.owner === user.owner) + 1;

	const getPodiumStyle = (indexInDisplay: number) => {
		const isFirst =
			(podium.length >= 2 && indexInDisplay === 1) || (podium.length === 1 && indexInDisplay === 0);

		if (isFirst) {
			return 'h-16 w-16 border-primary ring-primary/20 ring-4 shadow-2xl sm:h-20 sm:w-20';
		}

		if (indexInDisplay === 0) {
			return 'h-12 w-12 border-muted-foreground/40 ring-muted-foreground/10 ring-2 sm:h-14 sm:w-14';
		}

		return 'h-12 w-12 border-laurel-deep ring-laurel-deep/10 ring-2 sm:h-14 sm:w-14';
	};

	const getMedalLabelKey = (indexInDisplay: number): MessageKey => {
		const isFirst =
			(podium.length >= 2 && indexInDisplay === 1) || (podium.length === 1 && indexInDisplay === 0);

		if (isFirst) {
			return 'leaderboard.medal.gold';
		}

		if (indexInDisplay === 0) {
			return 'leaderboard.medal.silver';
		}

		return 'leaderboard.medal.bronze';
	};

	const activeDescriptionKey: MessageKey = $derived.by(() => {
		if (activeTab === 'friends') {
			return 'leaderboard.scope.friends';
		}

		if (activeTab === 'week') {
			return 'leaderboard.scope.week';
		}

		if (activeTab === 'activity') {
			return 'leaderboard.scope.activity';
		}

		return 'leaderboard.scope.global';
	});
</script>

{#snippet socialAppbarRight()}
	<span class="social-mobile-icon" aria-hidden="true">
		<Users size={18} strokeWidth={1.8} />
	</span>
{/snippet}

<div class="space-y-7 pb-24">
	<MobileAppBar
		align="left"
		right={socialAppbarRight}
		title={t({ locale: $localeStore, key: 'leaderboard.title' })}
	/>

	<div class="hidden md:block">
		<SectionHeader
			description={t({ locale: $localeStore, key: 'leaderboard.sub' })}
			highlight={t({ locale: $localeStore, key: 'leaderboard.eyebrow' })}
			title={t({ locale: $localeStore, key: 'leaderboard.title' })}
		/>
	</div>

	<section
		class="border-border bg-card shadow-card relative overflow-hidden rounded-[2rem] border p-4 sm:p-5"
	>
		<div
			class="from-primary/12 pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent"
		></div>
		<div class="relative space-y-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="text-primary text-[10px] font-black tracking-[0.16em] uppercase">
						{t({ locale: $localeStore, key: 'leaderboard.eyebrow' })}
					</p>
					<p class="text-muted-foreground mt-1 text-sm">
						{t({ locale: $localeStore, key: activeDescriptionKey })}
					</p>
				</div>
				<p class="text-muted-foreground font-mono text-[10px] font-bold tracking-widest uppercase">
					{t({
						locale: $localeStore,
						key: 'leaderboard.social.count',
						params: { count: rankedUsers.length }
					})}
				</p>
			</div>

			<div class="grid grid-cols-2 gap-2 md:grid-cols-4">
				{#each socialTabs as tab (tab.id)}
					<button
						class={[
							'rounded-full border px-3 py-2.5 text-xs font-black tracking-[0.14em] uppercase transition-all',
							activeTab === tab.id
								? 'border-primary/40 bg-primary text-primary-foreground shadow-card'
								: 'border-border bg-background/35 text-muted-foreground hover:border-border-strong hover:text-foreground'
						]}
						aria-pressed={activeTab === tab.id}
						onclick={() => (activeTab = tab.id)}
					>
						{t({ locale: $localeStore, key: tab.labelKey })}
					</button>
				{/each}
			</div>
		</div>
	</section>

	{#if loading}
		<div class="flex flex-col items-center justify-center space-y-4 py-24">
			<div
				class="border-primary h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
			></div>
			<p class="text-muted-foreground animate-pulse text-xs font-bold tracking-widest uppercase">
				{t({ locale: $localeStore, key: 'leaderboard.loading' })}
			</p>
		</div>
	{:else if activeTab === 'activity'}
		<ActivityFeed mode="global" userPrincipal={currentUser ?? ''} />
	{:else if rankedUsers.length === 0}
		<div class="border-border bg-card rounded-[1.75rem] border py-12 text-center">
			<p class="text-muted-foreground text-sm font-black tracking-widest uppercase">
				{t({
					locale: $localeStore,
					key: activeTab === 'friends' ? 'leaderboard.empty.friends' : 'leaderboard.empty'
				})}
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.9fr]">
			<div
				class="border-border bg-card shadow-card relative overflow-hidden rounded-[2rem] border p-5"
			>
				<div
					class="from-primary/10 pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent"
				></div>
				<div class="relative z-10 mb-4 flex items-center justify-between gap-3">
					<div>
						<p class="text-muted-foreground text-[10px] font-black tracking-[0.16em] uppercase">
							{t({ locale: $localeStore, key: 'leaderboard.row.rank' })}
						</p>
						<h2 class="text-foreground mt-1 text-xl font-semibold tracking-tight">
							{t({ locale: $localeStore, key: 'leaderboard.tab.global' })}
						</h2>
					</div>
					<div class="border-border bg-background/40 rounded-full border px-3 py-1.5">
						<span class="text-muted-foreground font-mono text-[10px] font-bold uppercase">
							{t({ locale: $localeStore, key: 'leaderboard.tab.week' })}
						</span>
					</div>
				</div>

				<div class="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
					{#each displayPodium as user, i (user.owner)}
						<div
							class={[
								'border-border bg-background/45 rounded-2xl border p-4 transition-all hover:-translate-y-1',
								user.owner === currentUser && 'border-primary/60 bg-primary/10',
								(podium.length >= 2 && i === 1) || (podium.length === 1 && i === 0)
									? 'sm:-mt-3'
									: 'sm:mt-5'
							]}
							in:fly={{ y: 28, delay: i * 120 }}
						>
							<div class="flex items-start justify-between gap-3">
								<Avatar
									class="bg-card border-2 shadow-xl {getPodiumStyle(i)}"
									avatar={user.avatar}
									nickname={user.nickname}
									owner={user.owner}
								/>
								<div
									class="bg-primary/10 text-primary border-primary/20 rounded-full border px-2 py-1 font-mono text-[9px] font-black tracking-[0.16em] uppercase"
								>
									{t({ locale: $localeStore, key: getMedalLabelKey(i) })}
								</div>
							</div>
							<div class="mt-4 min-w-0">
								<div class="flex items-center gap-1.5">
									<h3 class="text-foreground truncate text-sm font-black">
										{user.nickname}
									</h3>
									{#if user.owner === currentUser}
										<YouBadge />
									{/if}
								</div>
								<div class="mt-3 grid grid-cols-2 gap-2">
									<div>
										<p class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
											{t({ locale: $localeStore, key: 'leaderboard.row.xp' })}
										</p>
										<p class="text-primary font-mono text-sm font-black">
											{Math.floor(user.points ?? 0)}
										</p>
									</div>
									<div>
										<p class="text-muted-foreground text-[9px] font-bold tracking-widest uppercase">
											{t({ locale: $localeStore, key: 'leaderboard.row.accuracy_short' })}
										</p>
										<p class="text-yes font-mono text-sm font-black">
											{Math.round(user.accuracy ?? 0)}%
										</p>
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="border-border bg-card shadow-card rounded-[2rem] border p-4 sm:p-5">
				<div class="mb-3 flex items-center justify-between gap-3">
					<p class="text-muted-foreground text-[10px] font-black tracking-[0.16em] uppercase">
						{t({ locale: $localeStore, key: 'leaderboard.tab.activity' })}
					</p>
					<span class="text-muted-foreground font-mono text-[10px] font-bold">
						{rest.length}
					</span>
				</div>
				<div class="space-y-2">
					{#each rest as user, i (user.owner)}
						<div
							class={[
								'group border-border bg-background/35 hover:border-primary/30 flex items-center justify-between rounded-2xl border p-3 transition-all',
								user.owner === currentUser && 'border-primary/50 bg-primary/10'
							]}
							in:fade={{ delay: i * 25 }}
						>
							<div class="flex min-w-0 items-center gap-3">
								<span class="text-muted-foreground w-8 text-center font-mono text-xs font-black">
									#{globalRank(user)}
								</span>
								<Avatar
									class="ring-border bg-card h-9 w-9 shadow-inner ring-2"
									avatar={user.avatar}
									nickname={user.nickname}
									owner={user.owner}
								/>
								<div class="min-w-0">
									<div class="flex items-center gap-1.5">
										<p class="text-foreground max-w-34 truncate text-xs font-bold sm:max-w-none">
											{user.nickname}
										</p>
										{#if user.owner === currentUser}
											<YouBadge />
										{/if}
									</div>
									<div class="mt-0.5 flex items-center gap-2">
										<span class="text-muted-foreground font-mono text-[9px] font-bold uppercase">
											{t({
												locale: $localeStore,
												key: 'leaderboard.row.streak',
												params: { count: user.dailyStreak ?? 1 }
											})}
										</span>
										<span class="text-border text-[9px]">•</span>
										<span class="text-yes font-mono text-[9px] font-bold uppercase">
											{t({
												locale: $localeStore,
												key: 'leaderboard.row.accuracy',
												params: { accuracy: Math.round(user.accuracy ?? 0) }
											})}
										</span>
									</div>
								</div>
							</div>
							<div class="flex flex-col items-end text-right">
								<p class="text-foreground font-mono text-xs font-black tabular-nums">
									{Math.floor(user.points ?? 0)}
								</p>
								<p class="text-muted-foreground text-[9px] leading-none font-bold uppercase">
									{t({ locale: $localeStore, key: 'leaderboard.row.xp' })}
								</p>
							</div>
						</div>
					{:else}
						<div
							class="border-border bg-background/35 rounded-2xl border border-dashed p-6 text-center"
						>
							<p class="text-muted-foreground text-xs font-bold tracking-widest uppercase">
								{t({ locale: $localeStore, key: 'leaderboard.empty' })}
							</p>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style lang="postcss">
	.social-mobile-icon {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--color-primary);
	}
</style>
