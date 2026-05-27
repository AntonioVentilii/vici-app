<script lang="ts">
	import { ArrowUp, Check, ChevronDown, Flame, Gift, Sparkles, X } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import DashAccuracySparkline from '$lib/components/dash/DashAccuracySparkline.svelte';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import { ACHIEVEMENTS } from '$lib/constants/achievements.constants';
	import { ZERO } from '$lib/constants/app.constants';
	import { ACCURACY_GATE_CALLS, isAccuracyUnlocked } from '$lib/constants/flow-rewards.constants';
	import { MARKET_TAGS, type MarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { positions } from '$lib/derived/positions.derived';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import { calculateAndSyncStats, getProfile } from '$lib/services/profile.services';
	import { loadMyUserStats } from '$lib/services/user-stats.services';
	import { balancesStore } from '$lib/stores/balances.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { marketsStore } from '$lib/stores/markets.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import type { UserStatsDoc } from '$lib/types/user-stats';
	import { t, type MessageKey } from '$lib/utils/i18n.utils';

	type TimeWindow = '7d' | '30d' | '90d' | 'all';
	type PastFilter = 'all' | 'won' | 'lost';

	const profile = $derived($userStore.profile);
	const nickname = $derived(profile?.nickname ?? '');
	const totalTrades = $derived(profile?.totalTrades ?? 0);
	const accuracyUnlocked = $derived(isAccuracyUnlocked(totalTrades));
	const accuracyValue = $derived(profile?.accuracy ?? 0);
	const accuracyPct = $derived(
		profile && accuracyUnlocked ? Math.round(accuracyValue * 1000) / 10 : null
	);
	const streakDays = $derived(profile?.dailyStreak ?? 0);
	const callsToUnlock = $derived(Math.max(0, ACCURACY_GATE_CALLS - totalTrades));

	// Per-user dash cache. Recomputed on mount so accuracy + category
	// breakdown reflect any markets that resolved since the user signed
	// in — the rest of the app already keeps positions/orders/history
	// fresh on a 30s poll, so the Dash needs to match.
	let userStats = $state<UserStatsDoc | undefined>(undefined);

	let timeWindow = $state<TimeWindow>('30d');
	let pastFilter = $state<PastFilter>('all');

	// VXP balance via the global balances store. Falls back to `0n`
	// while the balance is still loading so the hero doesn't pop.
	const vxpBalance = $derived($balancesStore?.[VXP_TOKEN.id] ?? ZERO);
	const vxpBalanceNum = $derived(Number(vxpBalance));

	// Active positions — pulled live from the existing store.
	const activePositions = $derived($positions);
	const activeCount = $derived(activePositions.length);

	const marketById = $derived(new Map<string, Market>(($marketsStore ?? []).map((m) => [m.id, m])));

	// Category breakdown — sorted desc by accuracy, only categories
	// the user has actually called on.
	interface CategoryRow {
		tag: MarketTag;
		calls: number;
		wins: number;
		accuracy: number;
	}

	const categoryRows = $derived<CategoryRow[]>(
		(() => {
			const stats = userStats?.categoryStats ?? {};

			return MARKET_TAGS.map((tag) => {
				const bucket = stats[tag] ?? { calls: 0, wins: 0 };
				const accuracy = bucket.calls > 0 ? bucket.wins / bucket.calls : 0;

				return { tag, calls: bucket.calls, wins: bucket.wins, accuracy };
			})
				.filter((row) => row.calls > 0)
				.sort((a, b) => b.accuracy - a.accuracy);
		})()
	);

	const topCategory = $derived<CategoryRow | undefined>(categoryRows[0]);

	// Recent settlements — wins + losses sliced from the cache.
	const recentSettlements = $derived(userStats?.recentSettlements ?? []);
	const totalWins = $derived(recentSettlements.filter((s) => s.win).length);
	const totalLosses = $derived(recentSettlements.length - totalWins);

	const filteredHistory = $derived(
		recentSettlements.filter((s) => {
			if (pastFilter === 'won') {
				return s.win;
			}

			if (pastFilter === 'lost') {
				return !s.win;
			}

			return true;
		})
	);

	// Next-unlock achievement — pick the first one the user hasn't
	// earned yet. Falls back to "Marathon" so the surface stays
	// populated even when every achievement is unlocked.
	const unlocked = $derived(new Set<string>(profile?.unlockedAchievements ?? []));
	const nextAchievement = $derived(
		ACHIEVEMENTS.find((a) => !unlocked.has(a.id)) ?? ACHIEVEMENTS[ACHIEVEMENTS.length - 1]
	);

	// Achievement progress percent — best-effort approximation. We
	// don't model per-achievement progress server-side yet so we use
	// the streak/accuracy proxies the prototype uses for the same
	// surface.
	const nextProgressPct = $derived.by(() => {
		if (!nextAchievement) {
			return 0;
		}

		switch (nextAchievement.id) {
			case 'marathon':
				return Math.min(100, Math.round((streakDays / 30) * 100));
			case 'on-fire':
				return Math.min(100, Math.round((streakDays / 7) * 100));
			case 'oracle':
				return Math.min(100, Math.round(accuracyValue * 100));
			default:
				return Math.min(100, Math.round((totalTrades / ACCURACY_GATE_CALLS) * 100));
		}
	});

	// Oracle insight — derived from the best (most-recent winning)
	// settlement and the top category. Falls through to a generic
	// nudge when the user hasn't won anything yet.
	const bestWin = $derived(recentSettlements.find((s) => s.win));
	const bestWinTitle = $derived(
		bestWin ? (marketById.get(bestWin.marketId)?.title ?? bestWin.marketId) : ''
	);

	const tagLabelKey = (tag: MarketTag): MessageKey => `settings.flow_deck.category.${tag}`;

	const fmtVxp = (value: number): string => {
		if (!Number.isFinite(value)) {
			return '0';
		}

		const abs = Math.abs(value);

		if (abs >= 1_000_000) {
			return `${(value / 1_000_000).toFixed(1)}M`;
		}

		if (abs >= 1_000) {
			return `${(value / 1_000).toFixed(1)}K`;
		}

		return Math.round(value).toString();
	};

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
			return t({ locale: $localeStore, key: 'dash.history.hours_ago', params: { count: hours } });
		}

		const days = Math.floor(hours / 24);

		return t({ locale: $localeStore, key: 'dash.history.days_ago', params: { count: days } });
	};

	const fmtTimeLeft = (expiryMs: number): string => {
		const delta = expiryMs - Date.now();

		if (delta <= 0) {
			return t({ locale: $localeStore, key: 'dash.active.closed' });
		}

		const hours = Math.floor(delta / (1000 * 60 * 60));

		if (hours < 24) {
			return t({
				locale: $localeStore,
				key: 'dash.active.hours_left',
				params: { count: Math.max(1, hours) }
			});
		}

		const days = Math.floor(hours / 24);

		return t({ locale: $localeStore, key: 'dash.active.days_left', params: { count: days } });
	};

	const isUrgent = (expiryMs: number): boolean => {
		const delta = expiryMs - Date.now();

		return delta > 0 && delta <= 24 * 60 * 60 * 1000;
	};

	const marketTitle = (marketId: string): string => marketById.get(marketId)?.title ?? marketId;

	// Active calls — first three positions, sorted by soonest-closing
	// market expiry.
	const activeCalls = $derived(
		[...activePositions]
			.map((p) => ({ position: p, market: marketById.get(p.marketId) }))
			.filter(
				(entry): entry is { position: (typeof activePositions)[number]; market: Market } =>
					entry.market !== undefined
			)
			.sort((a, b) => Number(a.market.expiryDate) - Number(b.market.expiryDate))
			.slice(0, 3)
	);

	const closingTodayCount = $derived(
		activeCalls.filter((entry) => isUrgent(Number(entry.market.expiryDate))).length
	);

	// Lifetime VXP estimate — until a dedicated server-side counter
	// lands we approximate with the user's accumulated points (1 point
	// ≈ 1 VXP) plus the current balance. Surfacing _something_ here
	// is more useful than hiding the tile entirely.
	const lifetimeVxp = $derived(Math.max(vxpBalanceNum, (profile?.points ?? 0) + vxpBalanceNum));
	const sessionCalls = $derived(recentSettlements.length);

	// Window strip — kept as a visual switch until the per-window
	// trend aggregator lands server-side. The active state still
	// communicates intent and keeps the surface aligned with the
	// prototype.
	const timeWindows: { id: TimeWindow; label: MessageKey }[] = [
		{ id: '7d', label: 'dash.window.7d' },
		{ id: '30d', label: 'dash.window.30d' },
		{ id: '90d', label: 'dash.window.90d' },
		{ id: 'all', label: 'dash.window.all' }
	];

	onMount(async () => {
		if (profile === undefined) {
			return;
		}

		try {
			const identity = await safeGetIdentityOnce();
			await calculateAndSyncStats({ identity, domain: $balanceDomain });
			const profileDoc = await getProfile(profile.owner);
			userStore.update((s) => ({ ...s, profile: profileDoc.data }));
		} catch (err) {
			console.error('DashPage: failed to recompute stats', err);
		}

		try {
			userStats = await loadMyUserStats(profile.owner);
		} catch (err) {
			console.error('DashPage: failed to load user_stats', err);
		}
	});
</script>

<MobileAppBar title={t({ locale: $localeStore, key: 'dash.title' })} />

<div class="dash-root">
	<header class="dash-appbar-desk">
		<h2 class="dash-title">{t({ locale: $localeStore, key: 'dash.title' })}</h2>
	</header>

	<!-- Accuracy hero: big number + session delta + 30d anchor + streak inline. -->
	<section class="dash-hero" aria-labelledby="dash-accuracy-eyebrow">
		<span id="dash-accuracy-eyebrow" class="allcaps dash-ey">
			{t({ locale: $localeStore, key: 'dash.accuracy.eyebrow' })}
		</span>
		{#if accuracyPct !== null}
			<div class="display-num dash-big">
				{accuracyPct}<span class="dash-unit">%</span>
			</div>
			<div class="dash-meta-row">
				<span class="dash-delta dash-delta-neutral">
					<Sparkles aria-hidden="true" size={10} strokeWidth={2} />
					{nickname
						? t({
								locale: $localeStore,
								key: 'dash.accuracy.signed_in',
								params: { handle: nickname }
							})
						: t({ locale: $localeStore, key: 'dash.accuracy.signed_out' })}
				</span>
				<span class="dash-anchor">
					{t({ locale: $localeStore, key: 'dash.accuracy.global_anchor' })}
				</span>
			</div>
		{:else}
			<div class="display-num dash-big dash-big-muted">
				—<span class="dash-unit">%</span>
			</div>
			<div class="dash-meta-row">
				<span class="dash-delta dash-delta-neutral">
					{t({
						locale: $localeStore,
						key: 'dash.accuracy.locked',
						params: { count: callsToUnlock }
					})}
				</span>
			</div>
		{/if}

		<div class="dash-streak-row">
			<span class="dash-flame" aria-hidden="true">
				<Flame size={20} strokeWidth={2} />
			</span>
			<div class="dash-streak-text">
				<span class="dash-streak-big num">
					{streakDays}
					<span class="dash-streak-unit">
						{streakDays === 1
							? t({ locale: $localeStore, key: 'dash.streak.day_one' })
							: t({ locale: $localeStore, key: 'dash.streak.day_many' })}
					</span>
				</span>
				<span class="dash-streak-sub">
					{t({
						locale: $localeStore,
						key: 'dash.streak.to_marathon',
						params: { count: Math.max(0, 30 - streakDays) }
					})}
				</span>
			</div>
			<div class="dash-streak-bar" aria-hidden="true">
				<span style:width="{Math.min(100, (streakDays / 30) * 100)}%" class="dash-streak-fill"
				></span>
			</div>
		</div>
	</section>

	<!-- Time-window chip strip. -->
	<div
		class="dash-window"
		aria-label={t({ locale: $localeStore, key: 'dash.window.label' })}
		role="tablist"
	>
		{#each timeWindows as win (win.id)}
			<button
				class="dash-window-chip"
				class:is-active={timeWindow === win.id}
				aria-selected={timeWindow === win.id}
				onclick={() => (timeWindow = win.id)}
				role="tab"
				type="button"
			>
				{t({ locale: $localeStore, key: win.label })}
			</button>
		{/each}
	</div>

	<!-- Holdings card. -->
	<section class="dash-section" aria-labelledby="dash-holdings-eyebrow">
		<div class="dash-card dash-holdings">
			<span id="dash-holdings-eyebrow" class="allcaps dash-ey">
				{t({ locale: $localeStore, key: 'dash.holdings.eyebrow' })}
			</span>
			<span class="dash-purpose">
				{t({ locale: $localeStore, key: 'dash.holdings.purpose' })}
			</span>
			<div class="dash-balance num">
				{vxpBalanceNum.toLocaleString()}<span class="dash-balance-unit">VXP</span>
			</div>
			<div class="dash-sub-stats">
				<div class="dash-sub-stat">
					<span class="allcaps dash-sub-lbl">
						{t({ locale: $localeStore, key: 'dash.holdings.backed' })}
					</span>
					<span class="num dash-sub-val">{fmtVxp(vxpBalanceNum * 0.4)}</span>
				</div>
				<div class="dash-sub-stat">
					<span class="allcaps dash-sub-lbl">
						{t({ locale: $localeStore, key: 'dash.holdings.lifetime' })}
					</span>
					<span class="num dash-sub-val">{fmtVxp(lifetimeVxp)}</span>
				</div>
				<div class="dash-sub-stat">
					<span class="allcaps dash-sub-lbl">
						{t({ locale: $localeStore, key: 'dash.holdings.session' })}
					</span>
					<span class="num dash-sub-val">
						{t({
							locale: $localeStore,
							key: sessionCalls === 1 ? 'dash.holdings.session_one' : 'dash.holdings.session_many',
							params: { count: sessionCalls }
						})}
					</span>
				</div>
			</div>

			<button class="dash-referral" onclick={() => goto(resolve(AppPath.Social))} type="button">
				<span class="dash-referral-left">
					<span class="dash-referral-gift" aria-hidden="true">
						<Gift size={12} strokeWidth={1.8} />
					</span>
					<span class="dash-referral-text">
						<span class="dash-referral-h">
							{t({ locale: $localeStore, key: 'dash.holdings.invite_title' })}
						</span>
						<span class="dash-referral-s">
							{t({ locale: $localeStore, key: 'dash.holdings.invite_sub' })}
						</span>
					</span>
				</span>
				<span class="dash-referral-arrow">
					{t({ locale: $localeStore, key: 'dash.holdings.invite_cta' })}
				</span>
			</button>
		</div>
	</section>

	<!-- Accuracy trend sparkline. -->
	<section class="dash-section" aria-labelledby="dash-trend-eyebrow">
		<div class="dash-section-eyebrow">
			<span id="dash-trend-eyebrow">
				{t({ locale: $localeStore, key: 'dash.trend.eyebrow' })} · {t({
					locale: $localeStore,
					key: `dash.window.${timeWindow}`
				})}
			</span>
			<span class="dash-delta-pos">
				<ArrowUp aria-hidden="true" size={10} strokeWidth={2.5} />
				{t({ locale: $localeStore, key: 'dash.trend.delta' })}
			</span>
		</div>
		<div class="dash-chart-card">
			<DashAccuracySparkline />
		</div>
	</section>

	<!-- Active calls — list with urgency timers. -->
	<section class="dash-section" aria-labelledby="dash-active-eyebrow">
		<div class="dash-section-eyebrow">
			<span id="dash-active-eyebrow">
				{t({ locale: $localeStore, key: 'dash.active.eyebrow' })}
				{#if closingTodayCount > 0}
					<span class="dash-urgency">
						{t({
							locale: $localeStore,
							key: 'dash.active.closing_today',
							params: { count: closingTodayCount }
						})}
					</span>
				{/if}
			</span>
			<a class="dash-see-all" href={resolve(AppPath.Portfolio)}>
				{t({ locale: $localeStore, key: 'dash.active.see_all', params: { count: activeCount } })}
			</a>
		</div>
		{#if activeCalls.length === 0}
			<p class="dash-empty">
				{t({ locale: $localeStore, key: 'dash.placeholder.positions' })}
			</p>
		{:else}
			<ul class="dash-active-list">
				{#each activeCalls as entry (entry.position.marketId)}
					{@const { market } = entry}
					{@const side = entry.position.outcomeId === 'YES' ? 'YES' : 'NO'}
					{@const pct = Math.round(
						(side === 'YES' ? market.yesProbability : market.noProbability) * 100
					)}
					{@const expiryMs = Number(market.expiryDate)}
					{@const urgent = isUrgent(expiryMs)}
					<li>
						<a class="dash-pos-row" href={resolve(`${AppPath.Markets}/${market.id}`)}>
							<div class="dash-pos-left">
								<div class="dash-pos-q">{market.title}</div>
								<div class="dash-pos-ctx">
									<span class="dash-side dash-side-{side.toLowerCase()}">{side}</span>
								</div>
							</div>
							<div class="dash-pos-right">
								<span class="num dash-pos-pct">{pct}%</span>
								<span class="dash-pos-timer" class:is-urgent={urgent}>
									{fmtTimeLeft(expiryMs)}
								</span>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- By-category breakdown: horizontal bars, sorted desc, only categories
	     with calls. -->
	<section class="dash-section" aria-labelledby="dash-cat-eyebrow">
		<div class="dash-section-eyebrow">
			<span id="dash-cat-eyebrow">
				{t({ locale: $localeStore, key: 'dash.categories.eyebrow' })}
			</span>
		</div>
		{#if categoryRows.length === 0}
			<p class="dash-empty">
				{t({ locale: $localeStore, key: 'dash.placeholder.categories' })}
			</p>
		{:else}
			<ul class="dash-cat-list">
				{#each categoryRows as row (row.tag)}
					{@const pct = Math.round(row.accuracy * 100)}
					<li class="dash-cat-row">
						<span class="dash-cat-name">
							{t({ locale: $localeStore, key: tagLabelKey(row.tag) })}
						</span>
						<div class="dash-cat-bar" aria-hidden="true">
							<span style:width="{pct}%" class="dash-cat-fill"></span>
						</div>
						<span class="num dash-cat-pct">{pct}%</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Where you stand. -->
	<section class="dash-section" aria-labelledby="dash-rank-eyebrow">
		<div class="dash-section-eyebrow">
			<span id="dash-rank-eyebrow">
				{t({ locale: $localeStore, key: 'dash.rank.eyebrow' })}
			</span>
		</div>
		<div class="dash-rank-grid">
			<div class="dash-rank-tile">
				<span class="allcaps dash-rank-lbl">
					{t({ locale: $localeStore, key: 'dash.rank.global' })}
				</span>
				<span class="num dash-rank-v">
					{t({ locale: $localeStore, key: 'dash.rank.placeholder' })}
				</span>
				<span class="dash-rank-sub">
					{t({ locale: $localeStore, key: 'dash.rank.global_sub' })}
				</span>
			</div>
			<button
				class="dash-rank-tile dash-rank-tile-btn"
				onclick={() => goto(resolve(AppPath.Social))}
				type="button"
			>
				<span class="allcaps dash-rank-lbl">
					{t({ locale: $localeStore, key: 'dash.rank.league' })}
				</span>
				<span class="num dash-rank-v">
					{t({ locale: $localeStore, key: 'dash.rank.placeholder' })}
				</span>
				<span class="dash-rank-sub">
					{t({ locale: $localeStore, key: 'dash.rank.league_sub' })}
				</span>
			</button>
			<div class="dash-rank-tile">
				<span class="allcaps dash-rank-lbl">
					{#if topCategory}
						{t({ locale: $localeStore, key: tagLabelKey(topCategory.tag) })}
					{:else}
						{t({ locale: $localeStore, key: 'dash.rank.top_cat' })}
					{/if}
				</span>
				<span class="num dash-rank-v dash-rank-v-acc">
					{#if topCategory}
						{Math.round(topCategory.accuracy * 100)}%
					{:else}
						—
					{/if}
				</span>
				<span class="dash-rank-sub">
					{t({ locale: $localeStore, key: 'dash.rank.top_cat_sub' })}
				</span>
			</div>
		</div>
	</section>

	<!-- Oracle insight callout. -->
	<section class="dash-section" aria-labelledby="dash-oracle-eyebrow">
		<div class="dash-oracle">
			<span id="dash-oracle-eyebrow" class="allcaps dash-oracle-lbl">
				{t({ locale: $localeStore, key: 'dash.oracle.eyebrow' })}
			</span>
			{#if bestWin}
				<p class="dash-oracle-q">
					{t({
						locale: $localeStore,
						key: 'dash.oracle.best_call',
						params: { title: bestWinTitle }
					})}
				</p>
				<span class="dash-oracle-sub">
					{t({ locale: $localeStore, key: 'dash.oracle.best_call_sub' })}
				</span>
			{:else if topCategory}
				<p class="dash-oracle-q">
					{t({
						locale: $localeStore,
						key: 'dash.oracle.strongest',
						params: {
							category: t({ locale: $localeStore, key: tagLabelKey(topCategory.tag) }),
							pct: Math.round(topCategory.accuracy * 100)
						}
					})}
				</p>
				<span class="dash-oracle-sub">
					{t({ locale: $localeStore, key: 'dash.oracle.strongest_sub' })}
				</span>
			{:else}
				<p class="dash-oracle-q">
					{t({ locale: $localeStore, key: 'dash.oracle.empty' })}
				</p>
				<span class="dash-oracle-sub">
					{t({ locale: $localeStore, key: 'dash.oracle.empty_sub' })}
				</span>
			{/if}
		</div>
	</section>

	<!-- Past predictions with filter chips. -->
	<section class="dash-section" aria-labelledby="dash-past-eyebrow">
		<div class="dash-section-eyebrow">
			<span id="dash-past-eyebrow">
				{t({ locale: $localeStore, key: 'dash.past.eyebrow' })}
			</span>
			<span class="dash-see-all dash-see-all-static">
				{t({ locale: $localeStore, key: 'dash.past.total', params: { count: totalTrades } })}
			</span>
		</div>
		<div class="dash-filter-chips" role="tablist">
			<button
				class="dash-filter-chip"
				class:is-active={pastFilter === 'all'}
				aria-selected={pastFilter === 'all'}
				onclick={() => (pastFilter = 'all')}
				role="tab"
				type="button"
			>
				{t({ locale: $localeStore, key: 'dash.past.filter_all' })}
			</button>
			<button
				class="dash-filter-chip"
				class:is-active={pastFilter === 'won'}
				aria-selected={pastFilter === 'won'}
				onclick={() => (pastFilter = 'won')}
				role="tab"
				type="button"
			>
				{t({ locale: $localeStore, key: 'dash.past.filter_won', params: { count: totalWins } })}
			</button>
			<button
				class="dash-filter-chip"
				class:is-active={pastFilter === 'lost'}
				aria-selected={pastFilter === 'lost'}
				onclick={() => (pastFilter = 'lost')}
				role="tab"
				type="button"
			>
				{t({ locale: $localeStore, key: 'dash.past.filter_lost', params: { count: totalLosses } })}
			</button>
		</div>
		<div>
			{#if filteredHistory.length === 0}
				<div class="dash-empty">
					{t({ locale: $localeStore, key: 'dash.past.empty' })}
				</div>
			{:else}
				<ul class="dash-past-list">
					{#each filteredHistory.slice(0, 8) as row (row.marketId + row.settledAtMs)}
						{@const xp = 240}
						<li>
							<a class="dash-past-row" href={resolve(`${AppPath.Markets}/${row.marketId}`)}>
								<span class="dash-past-res" class:is-lost={!row.win} class:is-won={row.win}>
									{#if row.win}
										<Check aria-hidden="true" size={11} strokeWidth={3} />
									{:else}
										<X aria-hidden="true" size={11} strokeWidth={3} />
									{/if}
								</span>
								<div class="dash-past-body">
									<div class="dash-past-q">{marketTitle(row.marketId)}</div>
									<div class="dash-past-ctx">
										{fmtRelativeTime(row.settledAtMs)}
									</div>
								</div>
								<span class="num dash-past-delta" class:is-lost={!row.win} class:is-won={row.win}>
									{row.win ? '+' : '−'}{xp} VXP
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>

	<!-- Next-unlock achievement. -->
	{#if nextAchievement}
		<section class="dash-section" aria-labelledby="dash-next-eyebrow">
			<div class="dash-section-eyebrow">
				<span id="dash-next-eyebrow">
					{t({ locale: $localeStore, key: 'dash.next.eyebrow' })}
				</span>
			</div>
			<button class="dash-achv" onclick={() => goto(resolve(AppPath.Album))} type="button">
				<span class="dash-achv-em" aria-hidden="true">{nextAchievement.emblem}</span>
				<div class="dash-achv-body">
					<div class="dash-achv-name">
						{t({ locale: $localeStore, key: nextAchievement.nameKey })}
					</div>
					<div class="dash-achv-progress" aria-hidden="true">
						<span style:width="{nextProgressPct}%" class="dash-achv-fill"></span>
					</div>
					<div class="dash-achv-pct">
						{nextProgressPct}% ·
						{t({ locale: $localeStore, key: nextAchievement.descriptionKey })}
					</div>
				</div>
			</button>
		</section>
	{/if}

	<!-- Three disclosure foldouts. -->
	<details class="dash-disclosure">
		<summary>
			<span>{t({ locale: $localeStore, key: 'dash.disclosure.accuracy_title' })}</span>
			<ChevronDown aria-hidden="true" size={12} strokeWidth={1.8} />
		</summary>
		<div class="dash-disclosure-body">
			<p>{t({ locale: $localeStore, key: 'dash.disclosure.accuracy_body' })}</p>
		</div>
	</details>

	<details class="dash-disclosure">
		<summary>
			<span>{t({ locale: $localeStore, key: 'dash.disclosure.vxp_title' })}</span>
			<ChevronDown aria-hidden="true" size={12} strokeWidth={1.8} />
		</summary>
		<div class="dash-disclosure-body">
			<p>{t({ locale: $localeStore, key: 'dash.disclosure.vxp_body' })}</p>
		</div>
	</details>

	<details class="dash-disclosure">
		<summary>
			<span>{t({ locale: $localeStore, key: 'dash.disclosure.leagues_title' })}</span>
			<ChevronDown aria-hidden="true" size={12} strokeWidth={1.8} />
		</summary>
		<div class="dash-disclosure-body">
			<p>{t({ locale: $localeStore, key: 'dash.disclosure.leagues_body' })}</p>
			<button
				class="dash-disclosure-cta"
				onclick={() => goto(resolve(AppPath.Social))}
				type="button"
			>
				{t({ locale: $localeStore, key: 'dash.disclosure.leagues_cta' })}
			</button>
		</div>
	</details>

	<div class="dash-bottom-spacer" aria-hidden="true"></div>
</div>

<style lang="postcss">
	.dash-root {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0 1.25rem 0.5rem;
	}

	.dash-appbar-desk {
		display: none;
		padding: 1rem 1.25rem 0;
	}

	@media (min-width: 768px) {
		.dash-appbar-desk {
			display: block;
		}
	}

	.dash-title {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}

	.dash-ey {
		color: var(--text-muted);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	/* ───────── HERO ───────── */

	.dash-hero {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.5rem 1.25rem 1.25rem;
	}

	.dash-big {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
		font-size: 3.5rem;
		line-height: 1;
		letter-spacing: -0.04em;
		color: var(--text-base);
	}

	@media (min-width: 768px) {
		.dash-big {
			font-size: 4.5rem;
		}
	}

	.dash-big-muted {
		color: var(--text-muted);
	}

	.dash-unit {
		font-size: 0.4em;
		font-weight: 500;
		color: var(--text-muted);
	}

	.dash-meta-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		font-size: 11px;
	}

	.dash-delta {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: 600;
	}

	.dash-delta-neutral {
		color: var(--text-muted);
	}

	.dash-anchor {
		color: var(--text-muted);
		font-size: 11px;
	}

	.dash-streak-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.5rem;
		padding: 0.625rem 0;
		border-top: 1px solid var(--border-base);
	}

	.dash-flame {
		display: inline-flex;
		width: 28px;
		height: 28px;
		align-items: center;
		justify-content: center;
		color: var(--laurel);
	}

	.dash-streak-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.dash-streak-big {
		display: inline-flex;
		align-items: baseline;
		gap: 0.25rem;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-base);
	}

	.dash-streak-unit {
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--text-muted);
	}

	.dash-streak-sub {
		font-size: 11px;
		color: var(--text-muted);
	}

	.dash-streak-bar {
		width: 80px;
		height: 4px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--text-muted) 18%, transparent);
		overflow: hidden;
	}

	.dash-streak-fill {
		display: block;
		height: 100%;
		background: var(--laurel);
		border-radius: 999px;
		transition: width var(--d-hover) var(--ease-vici);
	}

	/* ───────── WINDOW STRIP ───────── */

	.dash-window {
		display: inline-flex;
		gap: 0.375rem;
		margin: 0 1.25rem 0.75rem;
		padding: 0;
	}

	.dash-window-chip {
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	.dash-window-chip:hover {
		color: var(--text-base);
	}

	.dash-window-chip.is-active {
		border-color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
		color: var(--laurel);
	}

	/* ───────── SECTIONS ───────── */

	.dash-section {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.75rem 1.25rem 1rem;
	}

	.dash-section-eyebrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		color: var(--text-muted);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.dash-urgency {
		margin-left: 0.5rem;
		padding: 1px 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--no) 14%, transparent);
		color: var(--no);
		font-size: 9px;
		text-transform: none;
		letter-spacing: 0;
	}

	.dash-see-all {
		color: var(--laurel);
		font-size: 11px;
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0;
		text-decoration: none;
	}

	.dash-see-all-static {
		color: var(--text-muted);
	}

	.dash-delta-pos {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--yes);
		font-size: 11px;
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0;
	}

	.dash-empty {
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	/* ───────── HOLDINGS ───────── */

	.dash-card {
		padding: 1rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12, 0.75rem);
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
	}

	.dash-holdings {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.dash-purpose {
		color: var(--text-muted);
		font-size: 11px;
	}

	.dash-balance {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		font-size: 2rem;
		font-weight: 600;
		letter-spacing: -0.03em;
		color: var(--text-base);
	}

	.dash-balance-unit {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.dash-sub-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding-top: 0.625rem;
		border-top: 1px solid var(--border-base);
	}

	.dash-sub-stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.dash-sub-lbl {
		color: var(--text-muted);
		font-size: 9px;
	}

	.dash-sub-val {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-base);
	}

	.dash-referral {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.75rem;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: 0.625rem;
		background: color-mix(in srgb, var(--laurel) 6%, transparent);
		color: var(--text-base);
		cursor: pointer;
		text-align: left;
		transition: background-color var(--d-hover) var(--ease-vici);
	}

	.dash-referral:hover {
		background: color-mix(in srgb, var(--laurel) 12%, transparent);
	}

	.dash-referral-left {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-width: 0;
	}

	.dash-referral-gift {
		display: inline-flex;
		width: 24px;
		height: 24px;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: color-mix(in srgb, var(--laurel) 22%, transparent);
		color: var(--laurel);
	}

	.dash-referral-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.dash-referral-h {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-base);
	}

	.dash-referral-s {
		font-size: 10px;
		color: var(--text-muted);
	}

	.dash-referral-arrow {
		color: var(--laurel);
		font-size: 11px;
		font-weight: 600;
	}

	/* ───────── CHART ───────── */

	.dash-chart-card {
		padding: 0.75rem 0.875rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-12, 0.75rem);
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
	}

	/* ───────── ACTIVE CALLS ───────── */

	.dash-active-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.dash-pos-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.625rem;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--border-base);
		border-radius: 0.625rem;
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
		color: var(--text-base);
		text-decoration: none;
		transition: background-color var(--d-hover) var(--ease-vici);
	}

	.dash-pos-row:hover {
		background: color-mix(in srgb, var(--bg-surface) 100%, transparent);
	}

	.dash-pos-left {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.dash-pos-q {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-base);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dash-pos-ctx {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 10px;
		color: var(--text-muted);
	}

	.dash-side {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.dash-side-yes {
		color: var(--yes);
	}

	.dash-side-no {
		color: var(--no);
	}

	.dash-pos-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
	}

	.dash-pos-pct {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-base);
	}

	.dash-pos-timer {
		font-size: 10px;
		color: var(--text-muted);
	}

	.dash-pos-timer.is-urgent {
		color: var(--no);
		font-weight: 600;
	}

	/* ───────── CATEGORY BARS ───────── */

	.dash-cat-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.dash-cat-row {
		display: grid;
		grid-template-columns: 5rem 1fr 2.5rem;
		align-items: center;
		gap: 0.625rem;
	}

	.dash-cat-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-base);
		text-transform: capitalize;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dash-cat-bar {
		height: 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
		overflow: hidden;
	}

	.dash-cat-fill {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--laurel);
		transition: width var(--d-hover) var(--ease-vici);
	}

	.dash-cat-pct {
		text-align: right;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-base);
	}

	/* ───────── WHERE YOU STAND ───────── */

	.dash-rank-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.dash-rank-tile {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0.75rem 0.625rem;
		border: 1px solid var(--border-base);
		border-radius: 0.625rem;
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
	}

	.dash-rank-tile-btn {
		cursor: pointer;
		text-align: left;
		color: inherit;
		font: inherit;
	}

	.dash-rank-lbl {
		color: var(--text-muted);
		font-size: 9px;
	}

	.dash-rank-v {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-base);
	}

	.dash-rank-v-acc {
		color: var(--laurel);
	}

	.dash-rank-sub {
		font-size: 10px;
		color: var(--text-muted);
	}

	/* ───────── ORACLE ───────── */

	.dash-oracle {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.875rem 1rem;
		border: 1px solid color-mix(in srgb, var(--laurel) 40%, transparent);
		border-radius: 0.625rem;
		background: color-mix(in srgb, var(--laurel) 8%, transparent);
	}

	.dash-oracle-lbl {
		color: var(--laurel);
		font-size: 9px;
	}

	.dash-oracle-q {
		margin: 0;
		font-family: var(--font-display, 'Tiempos Headline', Georgia, serif);
		font-style: italic;
		font-size: 0.9375rem;
		line-height: 1.35;
		color: var(--text-base);
	}

	.dash-oracle-sub {
		font-size: 11px;
		color: var(--text-muted);
	}

	/* ───────── PAST PREDICTIONS ───────── */

	.dash-filter-chips {
		display: inline-flex;
		gap: 0.375rem;
	}

	.dash-filter-chip {
		padding: 0.25rem 0.625rem;
		border: 1px solid var(--border-base);
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font-size: 10px;
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	.dash-filter-chip:hover {
		color: var(--text-base);
	}

	.dash-filter-chip.is-active {
		border-color: var(--laurel);
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
		color: var(--laurel);
	}

	.dash-past-list {
		display: flex;
		flex-direction: column;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.dash-past-row {
		display: grid;
		grid-template-columns: 24px 1fr auto;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--border-base) 60%, transparent);
		color: var(--text-base);
		text-decoration: none;
	}

	.dash-past-row:hover .dash-past-q {
		color: var(--laurel);
	}

	.dash-past-list li:last-child .dash-past-row {
		border-bottom: 0;
	}

	.dash-past-res {
		display: inline-flex;
		width: 20px;
		height: 20px;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
	}

	.dash-past-res.is-won {
		background: color-mix(in srgb, var(--yes) 18%, transparent);
		color: var(--yes);
	}

	.dash-past-res.is-lost {
		background: color-mix(in srgb, var(--no) 18%, transparent);
		color: var(--no);
	}

	.dash-past-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.dash-past-q {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-base);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color var(--d-hover) var(--ease-vici);
	}

	.dash-past-ctx {
		font-size: 10px;
		color: var(--text-muted);
	}

	.dash-past-delta {
		font-size: 0.75rem;
		font-weight: 600;
	}

	.dash-past-delta.is-won {
		color: var(--yes);
	}

	.dash-past-delta.is-lost {
		color: var(--no);
	}

	/* ───────── NEXT UNLOCK ───────── */

	.dash-achv {
		display: grid;
		grid-template-columns: 44px 1fr;
		align-items: center;
		gap: 0.875rem;
		padding: 0.875rem 1rem;
		border: 1px solid var(--border-base);
		border-radius: 0.625rem;
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background-color var(--d-hover) var(--ease-vici);
	}

	.dash-achv:hover {
		background: color-mix(in srgb, var(--bg-surface) 100%, transparent);
	}

	.dash-achv-em {
		display: inline-flex;
		width: 36px;
		height: 36px;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--laurel) 14%, transparent);
		color: var(--laurel);
		font-size: 1.25rem;
	}

	.dash-achv-body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.dash-achv-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-base);
	}

	.dash-achv-progress {
		height: 4px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--text-muted) 14%, transparent);
		overflow: hidden;
	}

	.dash-achv-fill {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--laurel);
		transition: width var(--d-hover) var(--ease-vici);
	}

	.dash-achv-pct {
		font-size: 10px;
		color: var(--text-muted);
	}

	/* ───────── DISCLOSURE FOLDOUTS ───────── */

	.dash-disclosure {
		margin: 0 1.25rem 0.5rem;
		padding: 0.625rem 0.875rem;
		border: 1px solid var(--border-base);
		border-radius: 0.625rem;
		background: color-mix(in srgb, var(--bg-surface) 86%, transparent);
	}

	.dash-disclosure summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-base);
		cursor: pointer;
		list-style: none;
	}

	.dash-disclosure summary::-webkit-details-marker {
		display: none;
	}

	.dash-disclosure-body {
		margin-top: 0.625rem;
		padding-top: 0.625rem;
		border-top: 1px solid color-mix(in srgb, var(--border-base) 60%, transparent);
		font-size: 0.8125rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.dash-disclosure-body p {
		margin: 0;
	}

	.dash-disclosure-cta {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--laurel);
		border-radius: 999px;
		background: color-mix(in srgb, var(--laurel) 10%, transparent);
		color: var(--laurel);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
	}

	.dash-bottom-spacer {
		height: 2rem;
	}
</style>
