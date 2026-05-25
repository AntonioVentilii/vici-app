<script lang="ts">
	import { Briefcase } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import FlameChar from '$lib/components/characters/FlameChar.svelte';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { ACCURACY_GATE_CALLS, isAccuracyUnlocked } from '$lib/constants/flow-rewards.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { positions } from '$lib/derived/positions.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import { t } from '$lib/utils/i18n.utils';
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

	<!-- Per-category accuracy. Requires per-category call tallying that
	     the satellite doesn't track yet (V1.2 maps the field as
	     me.categoryAcc[cat]). Placeholder stays until the category
	     ledger lands in a later Phase 7 / Phase 11 commit. -->
	<section
		class="surface border-border bg-card flex flex-col gap-3 rounded-2xl border px-5 py-4"
		aria-labelledby="dash-category-eyebrow"
	>
		<span id="dash-category-eyebrow" class="allcaps">
			{t({ locale: $localeStore, key: 'dash.categories.eyebrow' })}
		</span>
		<p class="text-muted-foreground text-sm">
			{t({ locale: $localeStore, key: 'dash.placeholder.categories' })}
		</p>
	</section>

	<!-- Past predictions history. Same story as categories — needs the
	     server-side resolved-call ledger. Placeholder for now. -->
	<section
		class="surface border-border bg-card flex flex-col gap-3 rounded-2xl border px-5 py-4"
		aria-labelledby="dash-history-eyebrow"
	>
		<span id="dash-history-eyebrow" class="allcaps">
			{t({ locale: $localeStore, key: 'dash.history.eyebrow' })}
		</span>
		<p class="text-muted-foreground text-sm">
			{t({ locale: $localeStore, key: 'dash.placeholder.history' })}
		</p>
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
</style>
