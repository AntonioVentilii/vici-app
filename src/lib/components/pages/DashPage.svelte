<script lang="ts">
	import { Briefcase } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import ComebackBanner from '$lib/components/dash/ComebackBanner.svelte';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { ACCURACY_GATE_CALLS, isAccuracyUnlocked } from '$lib/constants/flow-rewards.constants';
	import { MARKET_TAGS, type MarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { positions } from '$lib/derived/positions.derived';
	import { loadMyUserStats } from '$lib/services/user-stats.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { marketsStore } from '$lib/stores/markets.store';
	import { userStore } from '$lib/stores/user.store';
	import type { UserStatsDoc } from '$lib/types/user-stats';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';
	import { stageForStreak } from '$lib/utils/streak.utils';
	import { nextStreakMilestone } from '$lib/utils/vxp-economy.utils';

	const profile = $derived($userStore.profile);
	const nickname = $derived(profile?.nickname ?? '');
	const totalTrades = $derived(profile?.totalTrades ?? 0);
	const accuracyUnlocked = $derived(isAccuracyUnlocked(totalTrades));
	const accuracyPct = $derived(
		profile && accuracyUnlocked ? Math.round((profile.accuracy ?? 0) * 1000) / 10 : null
	);
	const streakDays = $derived(profile?.dailyStreak ?? 0);
	const flameStage = $derived(stageForStreak(streakDays));
	const nextMilestone = $derived(nextStreakMilestone({ streak: streakDays }));
	const activePositions = $derived($positions);
	const activeCount = $derived(activePositions.length);
	const callsToUnlock = $derived(Math.max(0, ACCURACY_GATE_CALLS - totalTrades));

	// Per-user dash cache. Loaded once on mount; refreshed whenever
	// `calculateAndSyncStats` runs server-side. Slight refresh delay is
	// acceptable per the design decision — a freshly-settled market may
	// not show up until the next sync.
	let userStats = $state<UserStatsDoc | undefined>(undefined);

	const categoryRows = $derived.by(() => {
		const stats = userStats?.categoryStats ?? {};

		return MARKET_TAGS.map((tag) => {
			const bucket = stats[tag] ?? { calls: 0, wins: 0 };
			const accuracy = bucket.calls > 0 ? Math.round((bucket.wins / bucket.calls) * 100) : null;

			return { tag, calls: bucket.calls, wins: bucket.wins, accuracy };
		});
	});

	const recentRows = $derived(userStats?.recentSettlements ?? []);

	const totalCategoryCalls = $derived(categoryRows.reduce((sum, row) => sum + row.calls, 0));

	const tagLabelKey = (tag: MarketTag): MessageKey => `settings.flow_deck.category.${tag}`;

	const fmtRelativeTime = (ms: number): string => {
		const delta = Date.now() - ms;
		const seconds = Math.floor(delta / 1000);

		if (seconds < 60) {
			return t({ locale: $localeStore, key: 'dash.history.just_now' });
		}

		const minutes = Math.floor(seconds / 60);

		if (minutes < 60) {
			return t({
				locale: $localeStore,
				key: 'dash.history.minutes_ago',
				params: { count: minutes }
			});
		}

		const hours = Math.floor(minutes / 60);

		if (hours < 24) {
			return t({
				locale: $localeStore,
				key: 'dash.history.hours_ago',
				params: { count: hours }
			});
		}

		const days = Math.floor(hours / 24);

		return t({
			locale: $localeStore,
			key: 'dash.history.days_ago',
			params: { count: days }
		});
	};

	const marketTitle = (marketId: string): string => {
		const found = ($marketsStore ?? []).find((m) => m.id === marketId);

		return found?.title ?? marketId;
	};

	onMount(async () => {
		if (profile === undefined) {
			return;
		}

		try {
			userStats = await loadMyUserStats(profile.owner);
		} catch (err) {
			console.error('DashPage: failed to load user_stats', err);
		}
	});
</script>

{#snippet dashAppbarRight()}
	<button
		class="dash-mobile-icon-btn"
		aria-label={t({ locale: $localeStore, key: 'nav.portfolio' })}
		onclick={() => goto(resolve(AppPath.Portfolio))}
		type="button"
	>
		<Briefcase aria-hidden="true" size={18} strokeWidth={1.8} />
	</button>
{/snippet}

<MobileAppBar right={dashAppbarRight} title={t({ locale: $localeStore, key: 'dash.title' })} />

<div class="mx-auto flex max-w-[var(--reading-max,64ch)] flex-col gap-6">
	<header class="hidden md:flex md:items-center md:justify-between">
		<SectionHeader
			description={t({ locale: $localeStore, key: 'dash.subtitle' })}
			title={t({ locale: $localeStore, key: 'dash.title' })}
		/>
	</header>

	<!-- Comeback grant banner — self-gated on balance == 0 and renders
	     nothing otherwise. Sits at the top of the dash because the
	     comeback narrative wants visibility, but disappears once the
	     user has any positive balance or has dismissed it. -->
	<ComebackBanner />

	<!-- Accuracy hero. Hidden behind the same call-count gate Flow uses so
	     a brand-new user doesn't see a noisy "5%" before they've played
	     enough hands for the stat to mean anything. -->
	<section
		class="surface border-border bg-card flex flex-col items-center gap-2 rounded-2xl border px-6 py-8"
		aria-labelledby="dash-accuracy-eyebrow"
	>
		<span id="dash-accuracy-eyebrow" class="allcaps">
			{t({ locale: $localeStore, key: 'dash.accuracy.eyebrow' })}
		</span>
		{#if accuracyPct !== null}
			<div class="display-num text-foreground text-6xl md:text-8xl">
				{accuracyPct}<span class="text-muted-foreground text-3xl md:text-5xl">%</span>
			</div>
			<p class="text-muted-foreground text-sm">
				{nickname
					? t({
							locale: $localeStore,
							key: 'dash.accuracy.signed_in',
							params: { handle: nickname }
						})
					: t({ locale: $localeStore, key: 'dash.accuracy.signed_out' })}
			</p>
		{:else}
			<div class="display-num text-muted-foreground text-6xl md:text-8xl">
				—<span class="text-muted-foreground text-3xl md:text-5xl">%</span>
			</div>
			<p class="text-muted-foreground text-sm">
				{t({
					locale: $localeStore,
					key: 'dash.accuracy.locked',
					params: { count: callsToUnlock }
				})}
			</p>
		{/if}
	</section>

	<!-- Streak card. Shows the live FlameChar at the current stage and the
	     bonus the user is on track for next, so the progress isn't just a
	     number — it has a payoff in view. -->
	<section
		class="surface border-border bg-card flex flex-col gap-3 rounded-2xl border px-5 py-4"
		aria-labelledby="dash-streak-eyebrow"
	>
		<span id="dash-streak-eyebrow" class="allcaps">
			{t({ locale: $localeStore, key: 'dash.streak.eyebrow' })}
		</span>
		<div class="flex items-center gap-3">
			<FlameChar animate={streakDays > 0} size={48} stage={flameStage} />
			<div class="flex flex-col">
				<span class="num text-foreground text-2xl font-semibold">
					{streakDays}
					<span class="text-muted-foreground ml-1 text-sm font-normal">
						{streakDays === 1
							? t({ locale: $localeStore, key: 'dash.streak.day_one' })
							: t({ locale: $localeStore, key: 'dash.streak.day_many' })}
					</span>
				</span>
				{#if nextMilestone}
					<span class="text-muted-foreground text-xs">
						{t({
							locale: $localeStore,
							key: 'dash.streak.to_next',
							params: { days: nextMilestone.daysToGo, bonus: nextMilestone.bonus }
						})}
					</span>
				{:else}
					<span class="text-muted-foreground text-xs">
						{t({ locale: $localeStore, key: 'dash.streak.maxed' })}
					</span>
				{/if}
			</div>
		</div>
	</section>

	<!-- Active positions teaser. Pulls live positions from the existing
	     store; the heavy detail (lock / payout / trade history) lives on
	     /portfolio which the "View all" link routes to. -->
	<section
		class="surface border-border bg-card flex flex-col gap-3 rounded-2xl border px-5 py-4"
		aria-labelledby="dash-positions-eyebrow"
	>
		<div class="flex items-center justify-between">
			<span id="dash-positions-eyebrow" class="allcaps">
				{t({ locale: $localeStore, key: 'dash.positions.eyebrow' })}
			</span>
			<a
				class="text-laurel hover:text-laurel-deep text-xs font-medium"
				href={resolve(AppPath.Portfolio)}
			>
				{t({ locale: $localeStore, key: 'dash.positions.view_all' })}
			</a>
		</div>
		{#if activeCount > 0}
			<p class="text-foreground text-sm">
				{t({
					locale: $localeStore,
					key: activeCount === 1 ? 'dash.positions.count_one' : 'dash.positions.count_many',
					params: { count: activeCount }
				})}
			</p>
		{:else}
			<p class="text-muted-foreground text-sm">
				{t({ locale: $localeStore, key: 'dash.placeholder.positions' })}
			</p>
		{/if}
	</section>

	<!-- Per-category accuracy. Reads from the per-user dashboard cache
	     (`USER_STATS`); rebuilt by `calculateAndSyncStats` after every
	     resolution event so the breakdown stays current. Buckets with
	     zero calls render in a "no data yet" state; the placeholder
	     copy surfaces only when *no* category has any calls. -->
	<section
		class="surface border-border bg-card flex flex-col gap-3 rounded-2xl border px-5 py-4"
		aria-labelledby="dash-category-eyebrow"
	>
		<span id="dash-category-eyebrow" class="allcaps">
			{t({ locale: $localeStore, key: 'dash.categories.eyebrow' })}
		</span>
		{#if totalCategoryCalls === 0}
			<p class="text-muted-foreground text-sm">
				{t({ locale: $localeStore, key: 'dash.placeholder.categories' })}
			</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each categoryRows as row (row.tag)}
					<li class="flex items-center justify-between gap-2">
						<span class="text-foreground text-sm font-medium capitalize">
							{t({ locale: $localeStore, key: tagLabelKey(row.tag) })}
						</span>
						<span class="text-muted-foreground num text-xs">
							{#if row.accuracy === null}
								{t({ locale: $localeStore, key: 'dash.categories.no_calls' })}
							{:else}
								<span class="text-foreground font-semibold">{row.accuracy}%</span>
								<span class="text-muted-foreground"> · {row.wins} / {row.calls}</span>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Past predictions history. Renders the last N resolved calls from
	     the dashboard cache (`USER_STATS.recentSettlements`). Each row
	     links back to the market detail so the user can see the full
	     resolution context. -->
	<section
		class="surface border-border bg-card flex flex-col gap-3 rounded-2xl border px-5 py-4"
		aria-labelledby="dash-history-eyebrow"
	>
		<span id="dash-history-eyebrow" class="allcaps">
			{t({ locale: $localeStore, key: 'dash.history.eyebrow' })}
		</span>
		{#if recentRows.length === 0}
			<p class="text-muted-foreground text-sm">
				{t({ locale: $localeStore, key: 'dash.placeholder.history' })}
			</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each recentRows as row (row.marketId + row.settledAtMs)}
					<li>
						<a
							class="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-(--bg-popover)"
							href={resolve(`${AppPath.Markets}/${row.marketId}`)}
						>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="text-foreground truncate text-sm font-medium">
									{marketTitle(row.marketId)}
								</span>
								<span class="text-muted-foreground text-xs">
									{fmtRelativeTime(row.settledAtMs)}
								</span>
							</span>
							<span
								class="allcaps shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
								class:dash-history-loss={!row.win}
								class:dash-history-win={row.win}
							>
								{row.win
									? t({ locale: $localeStore, key: 'dash.history.win' })
									: t({ locale: $localeStore, key: 'dash.history.loss' })}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style lang="postcss">
	.dash-mobile-icon-btn {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--text-base);
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici);
	}

	.dash-mobile-icon-btn:hover {
		border-color: var(--border-strong);
		background: var(--bg-popover);
	}

	.dash-history-win {
		color: var(--yes, var(--laurel));
		background: color-mix(in srgb, var(--yes, var(--laurel)) 14%, transparent);
	}

	.dash-history-loss {
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
	}
</style>
