<script lang="ts">
	/**
	 * Dash screen — the user's at-a-glance accuracy + streak + recent
	 * activity surface. Backend fields that don't yet exist on the
	 * canister (rival, contrarian count, lifetime VXP, global rank, …)
	 * fall back to an em-dash placeholder rather than an approximation.
	 */
	import { Check } from '@lucide/svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import DashAccuracySparkline from '$lib/components/dash/DashAccuracySparkline.svelte';
	import DashActivePositions from '$lib/components/dash/DashActivePositions.svelte';
	import DashCategoryBreakdown from '$lib/components/dash/DashCategoryBreakdown.svelte';
	import DashDayZero from '$lib/components/dash/DashDayZero.svelte';
	import DashDisclosure from '$lib/components/dash/DashDisclosure.svelte';
	import DashHeroAccuracy from '$lib/components/dash/DashHeroAccuracy.svelte';
	import DashHoldingsCard from '$lib/components/dash/DashHoldingsCard.svelte';
	import DashNextUnlock from '$lib/components/dash/DashNextUnlock.svelte';
	import DashOracleInsight from '$lib/components/dash/DashOracleInsight.svelte';
	import DashPastPredictions from '$lib/components/dash/DashPastPredictions.svelte';
	import DashRankContext from '$lib/components/dash/DashRankContext.svelte';
	import DashResolutionBanner from '$lib/components/dash/DashResolutionBanner.svelte';
	import DashTodaysGoal from '$lib/components/dash/DashTodaysGoal.svelte';
	import PageScaffold from '$lib/components/layout/PageScaffold.svelte';
	import ResolutionReveal from '$lib/components/market/ResolutionReveal.svelte';
	import { ACHIEVEMENTS } from '$lib/constants/achievements.constants';
	import { EM_DASH, USD_DECIMALS } from '$lib/constants/app.constants';
	import {
		MARKET_TAG_LABEL_KEYS,
		MARKET_TAGS,
		type MarketTag
	} from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { marketTags } from '$lib/derived/market-tags.derived';
	import { orders } from '$lib/derived/orders.derived';
	import { positions } from '$lib/derived/positions.derived';
	import {
		resolvedPositions,
		resolvedPositionsNotInitialized
	} from '$lib/derived/resolved-positions.derived';
	import { vxpBacked, vxpHoldingsTotal, vxpSpendable } from '$lib/derived/vxp-holdings.derived';
	import { worldCupActive } from '$lib/derived/world-cup.derived';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import { getLeaderboard } from '$lib/services/leaderboard.services';
	import {
		calculateAndSyncStats,
		getDisplayName,
		getProfile
	} from '$lib/services/profile.services';
	import { loadMyUserStats } from '$lib/services/user-stats.services';
	import { markResolutionsSeen, maturedResolutions } from '$lib/stores/inbox.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { marketsStore } from '$lib/stores/markets.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import type { UserProfile } from '$lib/types/profile';
	import type { RecentSettlementSnapshot, UserStatsDoc } from '$lib/types/user-stats';
	import { DAILY_GOAL_TARGET } from '$lib/utils/daily-goal.utils';
	import { decimalFixedValueToNumber } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { formatVxpBalance } from '$lib/utils/playground-display.utils';

	type TimeWindow = '7d' | '30d' | '90d' | 'All';

	// — em-dash placeholder used everywhere a real backend number
	// isn't yet available — signals "unknown" rather than fabricating
	// data.
	const MARATHON_DAYS = 30;

	// ─── Reactive backend reads ────────────────────────────────────────
	const profile = $derived($userStore.profile);
	const nickname = $derived(profile?.nickname ?? '');
	const totalTrades = $derived(profile?.totalTrades ?? 0);
	// `profile.accuracy` is persisted as a 0..100 percentage (see
	// `profile.services.ts` `calculateAndSyncStats`). Render directly —
	// multiplying by 100 here gave 10000% for a fully-accurate user.
	const accuracyValue = $derived(profile?.accuracy ?? 0);
	const accuracyPct = $derived(accuracyValue.toFixed(1));
	const streak = $derived(profile?.dailyStreak ?? 0);
	// Personal-best streak. Defended with `max(…, streak)` so a legacy row
	// whose stored `longestStreak` hasn't self-healed yet never renders
	// below the current streak (the best can't be below today's run).
	const longestStreak = $derived(Math.max(profile?.longestStreak ?? 0, streak));
	// Daily-goal progress — the persisted cross-session counter feeds the
	// "Today's goal" resume card. The card itself rolls a stale day over to
	// 0 and hides until there's progress to resume.
	const dailyGoalDone = $derived(profile?.dailyGoalDone ?? 0);
	const dailyGoalDate = $derived(profile?.dailyGoalDate);

	let userStats = $state<UserStatsDoc | undefined>(undefined);
	// Points-ranked profiles from the satellite `listLeaderboard` query —
	// the source for the "Your rival" insight (the principal one rank
	// above the user). Empty until the onMount load resolves.
	let leaderboard = $state<UserProfile[]>([]);

	let tw = $state<TimeWindow>('30d');

	// Holdings for the current (playground / VXP) domain — one shared source
	// (`vxp-holdings.derived`) with the Trade modal, Portfolio, and Wallet:
	//  • spendable — "available to bet": free wallet balance + deposited
	//    clearing collateral, minus everything reserved for open positions AND
	//    resting orders. The honest headline figure.
	//  • backed — that reserved amount (positions + orders).
	//  • total — spendable + backed, i.e. everything the user holds.
	// All in `USD_DECIMALS`, which on VXP is the same 4-decimal scale 1:1, so
	// they render as plain VXP with no conversion.
	const availableDisplay = $derived(
		formatVxpBalance({ value: $vxpSpendable, decimals: USD_DECIMALS })
	);
	const backedDisplay = $derived(formatVxpBalance({ value: $vxpBacked, decimals: USD_DECIMALS }));
	const holdingsDisplay = $derived(
		formatVxpBalance({ value: $vxpHoldingsTotal, decimals: USD_DECIMALS })
	);

	// Lifetime = `profile.points`, the running XP/VXP accumulator the
	// satellite credits per win + streak bonus. Stored as a whole number
	// already; no decimal conversion needed.
	const lifetimeRaw = $derived(profile?.points ?? 0);
	const lifetimeDisplay = $derived(lifetimeRaw.toLocaleString());

	// Positions + markets — used by the Active calls block. The
	// "See all" count combines filled positions and resting limit
	// orders, since the Portfolio surface lists both.
	const activePositionsAll = $derived($positions);
	const openOrdersAll = $derived($orders);
	const totalActive = $derived(activePositionsAll.length + openOrdersAll.length);
	const marketById = $derived(new Map<string, Market>(($marketsStore ?? []).map((m) => [m.id, m])));

	const activePositions = $derived(
		[...activePositionsAll]
			.map((p) => ({ position: p, market: marketById.get(p.marketId) }))
			.filter(
				(entry): entry is { position: (typeof activePositionsAll)[number]; market: Market } =>
					entry.market !== undefined
			)
			.sort((a, b) => Number(a.market.expiryDate) - Number(b.market.expiryDate))
			.slice(0, 3)
	);

	// ─── Resolution digest (while-you-were-away) ───────────────────────
	// The standard dashboard leads with a tappable banner whenever calls
	// settled since the user last acknowledged them. Tapping opens the
	// ResolutionReveal overlay; both CTAs acknowledge the batch (clearing
	// the banner + the bell badge in lockstep via `markResolutionsSeen`)
	// and only pick where the user goes next.
	//
	// `revealSnapshot` is a frozen copy of the digest taken at the moment
	// the overlay opens. This prevents the card contents from blanking if
	// `markResolutionsSeen` clears the store while the overlay is still
	// visible (e.g. the user is mid-scroll before tapping a CTA).
	const digest = $derived($maturedResolutions);
	let revealOpen = $state(false);
	let revealSnapshot = $state($maturedResolutions);

	const openReveal = () => {
		revealSnapshot = $maturedResolutions;
		revealOpen = true;
	};

	// View in Dashboard — acknowledge + stay (we're already on the dash).
	const onRevealReview = () => {
		markResolutionsSeen();
		revealOpen = false;
	};

	// Back to the deck — acknowledge + head to Flow.
	const onRevealDismiss = () => {
		markResolutionsSeen();
		revealOpen = false;
		void goto(resolve(AppPath.Flow));
	};

	// ─── Per-user stats cache ──────────────────────────────────────────
	interface CategoryRow {
		id: MarketTag;
		label: string;
		acc: number;
	}

	const catRows = $derived.by<CategoryRow[]>(() => {
		const stats = userStats?.categoryStats ?? {};

		return MARKET_TAGS.filter((tag) => tag !== 'wc')
			.map((tag) => {
				const bucket = stats[tag] ?? { calls: 0, wins: 0 };
				const acc = bucket.calls > 0 ? bucket.wins / bucket.calls : 0;

				return {
					id: tag,
					label: t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[tag] }),
					acc
				};
			})
			.filter((row) => (stats[row.id]?.calls ?? 0) > 0)
			.sort((a, b) => b.acc - a.acc);
	});

	// World-Cup accuracy for the rank tile's WC variant — the `wc` bucket
	// is excluded from `catRows` (it's the event, not an evergreen
	// category), so derive it on its own. `undefined` until there's a call.
	const wcAccuracy = $derived.by(() => {
		const bucket = userStats?.categoryStats?.wc;

		return bucket && bucket.calls > 0 ? bucket.wins / bucket.calls : undefined;
	});

	const recentSettlements = $derived(userStats?.recentSettlements ?? []);

	// Win / loss tallies for the "Past predictions" filter chips. We count
	// settled markets from the clearing canister's `Settled` event stream
	// rather than deriving `losses = totalTrades − wins`, which used to
	// treat every Executed event as a settled trade and ended up counting
	// still-open positions as losses (e.g. "16 Executed events with 0
	// wins" was reported as 16 losses even when only 1 market had
	// resolved). The new store is uncapped — `userStats.recentSettlements`
	// is capped at `USER_STATS_RECENT_LIMIT`, so we deliberately do not
	// read these chip counts from there.
	const wins = $derived($resolvedPositions.filter((r) => r.result === 'won').length);
	const losses = $derived($resolvedPositions.filter((r) => r.result === 'lost').length);
	const settledTotal = $derived(wins + losses);

	// ─── Three-state gate ──────────────────────────────────────────────
	// The Dashboard renders one of three shapes:
	//   Day 0    · no calls placed at all → orientation hero + starter pack.
	//   Day 1+   · calls placed but none have settled (the featured event
	//              resolves weeks out) → "your call is in flight".
	//   Standard · at least one settled call → the full accuracy dashboard.
	// A "call" is any position the user has taken — live (filled or resting)
	// or already resolved. `totalTrades` is the profile's lifetime call
	// counter; `settledTotal` is the count of resolved calls. We OR in the
	// live position/order counts so a freshly-placed first call flips Day 0
	// → Day 1 immediately, before the satellite re-counts `totalTrades`.
	//
	// IMPORTANT: we must not branch on `settledTotal` until the trade-history
	// fetch has completed. While the store is still `undefined` (not yet
	// initialized), `resolvedPositions` defaults to `[]`, making `settledTotal`
	// look like 0 even for a returning user with resolved calls. Gate on
	// `resolvedPositionsNotInitialized` and render a loading state until the
	// store is ready, preventing the misroute to Day-1 for returning users.
	const resolvedPosNotInit = $derived($resolvedPositionsNotInitialized);
	const liveCallCount = $derived(activePositionsAll.length + openOrdersAll.length);
	const callsPlaced = $derived(Math.max(totalTrades, liveCallCount + settledTotal));
	const isDay0 = $derived(callsPlaced === 0);
	const isDay1Pending = $derived(!isDay0 && settledTotal === 0);

	// Day-0 pinned markets: the featured event's open markets first (the
	// starter deck), then any other open markets, so the "Today in Flow"
	// preview always has three rows where data allows. Sorted by volume so
	// the most-traded markets surface.
	const dayZeroMarkets = $derived.by<Market[]>(() => {
		const open = ($marketsStore ?? []).filter((m) => m.status === 'Open');
		const featuredTag = $featuredEvent.categoryTag;
		const isFeatured = (m: Market): boolean =>
			featuredTag !== undefined && ($marketTags[m.id] ?? []).some((tag) => tag === featuredTag);

		return [...open].sort((a, b) => {
			const fa = isFeatured(a) ? 0 : 1;
			const fb = isFeatured(b) ? 0 : 1;

			if (fa !== fb) {
				return fa - fb;
			}

			// Compare bigints directly to avoid Number precision loss on large volumes.
			if (b.totalVolume === a.totalVolume) {
				return 0;
			}

			return b.totalVolume > a.totalVolume ? 1 : -1;
		});
	});
	const dayZeroFeatured = $derived(dayZeroMarkets[0]);
	const dayZeroCompact = $derived(dayZeroMarkets.slice(1, 3));

	// Day-1 open position: the single live position, reframed for the
	// open-position card. `lockedCollateral` is in `USD_DECIMALS` units
	// (== VXP_TOKEN.decimals), so it converts to whole VXP for the caption.
	const dayOneFirstCall = $derived.by(() => {
		const [entry] = activePositions;

		if (entry === undefined) {
			return;
		}

		const side = entry.position.outcomeId === 'YES' ? 'YES' : 'NO';
		const stakeVxp = Math.round(
			decimalFixedValueToNumber({ value: entry.position.lockedCollateral, decimals: USD_DECIMALS })
		);

		return { market: entry.market, side, stakeVxp } as const;
	});

	// Live session delta — prior accuracy reconstruction.
	const sessionDelta = $derived.by<number | null>(() => {
		const session = recentSettlements;
		const sc = session.length;

		if (sc === 0) {
			return null;
		}

		const sw = session.filter((s) => s.win).length;
		const priorCalls = totalTrades - sc;

		if (priorCalls < 1) {
			return null;
		}

		const priorWins = Math.max(0, Math.round(accuracyValue * totalTrades) - sw);
		const priorAcc = priorWins / priorCalls;

		return Math.round((accuracyValue - priorAcc) * 1000) / 10;
	});

	// Past-prediction rows are shaped inside `DashPastPredictions` from the
	// same uncapped `$resolvedPositions` stream and `marketById` lookup, so
	// the row list stays consistent with the chip counts below.

	// `recentSettlements` (capped at `USER_STATS_RECENT_LIMIT`) used to be
	// combined with the broken lifetime `wins`/`losses` to render the
	// chip counts. Now that `wins`/`losses` are sourced from the
	// uncapped `$resolvedPositions` directly they're already complete,
	// so the separate "session" tallies are gone. The variable is kept
	// for the `sessionDelta` insight further up the file, which is a
	// distinct concept (accuracy delta in the recent window).

	// Best win for the Oracle insight — the user's highest-VXP settled
	// WIN in the recent window (the "best call" worth surfacing). When
	// nothing in the window won, this is `undefined` so the Oracle empty
	// state renders — never a loss dressed up as a "best call" (+0 VXP).
	// `vxp` and `contrarian` are threaded through the user_stats snapshot
	// from the clearing settlement event (see `user-stats.services`), so
	// the sub-line reads "+{vxp} VXP · contrarian win" / "· best call".
	const bestWin = $derived(
		recentSettlements
			.filter((s) => s.win)
			.reduce<
				RecentSettlementSnapshot | undefined
			>((best, s) => (best === undefined || s.vxp > best.vxp ? s : best), undefined)
	);
	const bestWinTitle = $derived(
		bestWin ? (marketById.get(bestWin.marketId)?.title ?? bestWin.marketId) : ''
	);
	const bestWinVxp = $derived(bestWin?.vxp ?? 0);
	const bestWinContrarian = $derived(bestWin?.contrarian ?? false);

	// Contrarian wins — settled wins the user took against the crowd
	// (the satellite tags each settlement with a `contrarian` flag,
	// derived from the execution price vs the long-shot threshold).
	const contrarianWins = $derived(
		recentSettlements.filter((s) => s.win && s.contrarian).slice(0, 3)
	);

	// ─── Rival ─────────────────────────────────────────────────────────
	// The user's rival is the adjacent competitor directly above them on
	// the points-ranked leaderboard — the next person to overtake. Derived
	// purely from the existing `listLeaderboard` query: find the user's own
	// row, take the one immediately above it. `undefined` (→ locked tease)
	// when the user isn't on the leaderboard yet or is already rank 1.
	const rival = $derived.by<
		{ name: string; initials: string; gapPts: number; acc: number } | undefined
	>(() => {
		const owner = profile?.owner;

		if (owner === undefined || leaderboard.length === 0) {
			return;
		}

		const myIndex = leaderboard.findIndex((entry) => entry.owner === owner);

		if (myIndex <= 0) {
			// Not ranked yet (−1) or already at the top (0) — no rival above.
			return;
		}

		const above = leaderboard[myIndex - 1];
		const me = leaderboard[myIndex];
		const name = getDisplayName({ profile: above });
		// Up to two leading initials from the display name, caps. Falls
		// back to a neutral glyph so the disc is never blank (brand: no
		// emoji avatar fallback — initials in a tinted disc).
		const initials =
			name
				.trim()
				.split(/\s+/)
				.map((part) => part.charAt(0))
				.join('')
				.slice(0, 2)
				.toUpperCase() || '·';

		return {
			name,
			initials,
			gapPts: Math.max(0, Math.round((above.points ?? 0) - (me.points ?? 0))),
			acc: above.accuracy ?? 0
		};
	});

	// Next-unlock achievement (Marathon by default).
	const unlocked = $derived(new Set<string>(profile?.unlockedAchievements ?? []));
	const nextAchievement = $derived(
		ACHIEVEMENTS.find((a) => !unlocked.has(a.id)) ?? ACHIEVEMENTS[ACHIEVEMENTS.length - 1]
	);
	const streakBarPct = $derived(Math.min(100, (streak / MARATHON_DAYS) * 100));
	const daysToMarathon = $derived(Math.max(0, MARATHON_DAYS - streak));

	// Markets the user hasn't tried — pick the first category with
	// zero settled calls (falls back to `Culture` when the taxonomy
	// is empty). Same satellite-cached source as `catRows` so the two
	// surfaces agree on what counts as "tried".
	const untriedCategory = $derived<MarketTag | undefined>(
		MARKET_TAGS.filter((tag) => tag !== 'wc').find(
			(tag) => (userStats?.categoryStats?.[tag]?.calls ?? 0) === 0
		)
	);

	// ─── Time window strip (visual switch only) ────────────────────────
	const windows: TimeWindow[] = ['7d', '30d', '90d', 'All'];

	// Page-chrome eyebrow: orientation line on Day 0/1, the live
	// streak + active time-window on the standard dashboard.
	const headerEyebrow = $derived.by(() => {
		if (isDay0) {
			return t({ locale: $localeStore, key: 'dash.dz.header_eyebrow_day0' });
		}

		if (isDay1Pending) {
			return t({ locale: $localeStore, key: 'dash.dz.header_eyebrow_day1' });
		}

		return t({
			locale: $localeStore,
			key: 'dash.header_eyebrow_standard',
			params: { count: streak, window: tw }
		});
	});

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

		try {
			// Powers the "Your rival" insight — the competitor one rank above
			// the user. Best-effort: a failed read leaves the rival as the
			// locked tease rather than blocking the dashboard.
			leaderboard = await getLeaderboard();
		} catch (err) {
			console.error('DashPage: failed to load leaderboard for rival', err);
		}
	});
</script>

<PageScaffold eyebrow={headerEyebrow} title={t({ locale: $localeStore, key: 'dash.title' })}>
	{#if resolvedPosNotInit && callsPlaced > 0}
		<!-- ─── LOADING · trade-history not yet initialized, can't gate safely ─── -->
		<!-- The user has placed at least one call but the resolved-positions store
		     hasn't finished loading yet. We cannot safely distinguish Day-1 from
		     Standard here: `settledTotal` reads as 0 from the empty default, which
		     would misroute a returning user with settled calls to the Day-1 view.
		     Show nothing until the store is ready (the positions/orders stores
		     load first, so this window is brief). Day-0 users (`callsPlaced === 0`)
		     skip this gate entirely — there is nothing settled to wait for. -->
	{:else if isDay0 || isDay1Pending}
		<!-- ─── DAY 0 / DAY 1+ pending · forward-looking dashboard ─── -->
		<DashDayZero
			{availableDisplay}
			{backedDisplay}
			compactMarkets={dayZeroCompact}
			day1={isDay1Pending}
			featuredMarket={dayZeroFeatured}
			firstCall={dayOneFirstCall}
			{holdingsDisplay}
			pendingCount={liveCallCount}
		/>
	{:else}
		<div class="screen-scroll">
			<!-- ─── Resolution banner · while-you-were-away ───
			     Leads the standard dashboard when calls settled since the user
			     last acknowledged them. Tapping opens the ResolutionReveal
			     overlay. `is-neg` flips the accent to measured (no laurel /
			     pulse) on a net-negative batch — the system never borrows
			     celebratory styling for a loss. -->
			{#if digest.count > 0}
				<DashResolutionBanner {digest} onOpen={openReveal} />
			{/if}

			<!-- ─── TODAY'S GOAL · resume the daily call goal ───
			     Leads the standard dashboard so the active nudge sits above
			     the accuracy overview. Self-hides until there's progress to
			     resume; nudges back into Flow while calls remain, then settles
			     into a calm complete state. -->
			<DashTodaysGoal date={dailyGoalDate} done={dailyGoalDone} target={DAILY_GOAL_TARGET} />

			<!-- ─── HERO · accuracy ─── -->
			<DashHeroAccuracy
				{accuracyPct}
				{daysToMarathon}
				{longestStreak}
				{nickname}
				{sessionDelta}
				{streak}
				{streakBarPct}
			/>

			<!-- ─── Time window ─── -->
			<div
				class="dash-window"
				aria-label={t({ locale: $localeStore, key: 'dash.window.label' })}
				role="tablist"
			>
				{#each windows as w (w)}
					<button
						class:active={tw === w}
						aria-selected={tw === w}
						onclick={() => (tw = w)}
						role="tab"
						type="button"
					>
						{w}
					</button>
				{/each}
			</div>

			<!-- ─── HOLDINGS card ─── -->
			<DashHoldingsCard
				{availableDisplay}
				{backedDisplay}
				{holdingsDisplay}
				{lifetimeDisplay}
				recentSettlementsCount={recentSettlements.length}
			/>

			<!-- ─── ACCURACY TREND chart ─── -->
			<div class="dash-section">
				<div class="dash-section-eyebrow">
					<span>
						{t({ locale: $localeStore, key: 'dash.trend.eyebrow' })} · {tw}
					</span>
					<span class="delta-pos">{t({ locale: $localeStore, key: 'dash.trend.delta' })}</span>
				</div>
				<div class="dash-chart-card">
					<DashAccuracySparkline />
				</div>
			</div>

			<!-- ─── ACTIVE positions ─── -->
			<DashActivePositions entries={activePositions} {totalActive} />

			<!-- ─── BY CATEGORY breakdown ─── -->
			<!-- Hidden during World-Cup mode: per-category accuracy is empty
		     when play is scoped to the event. -->
			{#if !$worldCupActive}
				<DashCategoryBreakdown {catRows} />
			{/if}

			<!-- ─── RANK CONTEXT ─── -->
			<DashRankContext topCategory={catRows[0]} {wcAccuracy} worldCupActive={$worldCupActive} />

			<!-- ─── ORACLE INSIGHT ─── -->
			<DashOracleInsight
				{bestWinContrarian}
				{bestWinTitle}
				{bestWinVxp}
				hasBestWin={Boolean(bestWin)}
			/>

			<!-- ─── PAST predictions ─── -->
			<DashPastPredictions
				{losses}
				{marketById}
				resolvedRows={$resolvedPositions}
				{settledTotal}
				{wins}
			/>

			<!-- ─── NEXT UNLOCK ─── -->
			{#if nextAchievement}
				<DashNextUnlock
					{daysToMarathon}
					emblem={nextAchievement.emblem}
					nameKey={nextAchievement.nameKey}
					{streak}
					{streakBarPct}
					target={MARATHON_DAYS}
				/>
			{/if}

			<!-- ─── DISCLOSURE foldouts ─── -->
			<!-- Your rival · the competitor one rank above the user on the
			     points leaderboard. Falls back to the locked tease (em-dashes)
			     until the user is ranked with someone above them. -->
			<DashDisclosure
				title={rival
					? t({
							locale: $localeStore,
							key: 'dash.disclosure.rival_title',
							params: { handle: rival.name }
						})
					: t({ locale: $localeStore, key: 'dash.disclosure.rival_title_unknown' })}
			>
				{#snippet body()}
					{#if rival}
						<div class="dash-rival">
							<span class="av">{rival.initials}</span>
							<div class="meta">
								<span class="name">{rival.name}</span>
								<span class="gap">
									{t({
										locale: $localeStore,
										key: 'dash.disclosure.rival_gap',
										params: { points: rival.gapPts }
									})}
								</span>
							</div>
							<span class="acc-num">{rival.acc.toFixed(1)}%</span>
						</div>
					{:else}
						<div class="dash-rival">
							<span class="av">{EM_DASH}</span>
							<div class="meta">
								<span class="name">{EM_DASH}</span>
								<span class="gap"
									>{t({ locale: $localeStore, key: 'dash.disclosure.rival_gap_unknown' })}</span
								>
							</div>
							<span class="acc-num">{EM_DASH}</span>
						</div>
					{/if}
				{/snippet}
			</DashDisclosure>

			<DashDisclosure
				title={t({
					locale: $localeStore,
					key: 'dash.disclosure.contrarian_title',
					params: { count: contrarianWins.length }
				})}
			>
				{#snippet body()}
					{#if contrarianWins.length === 0}
						<div class="dash-empty">
							{t({ locale: $localeStore, key: 'dash.disclosure.contrarian_empty' })}
						</div>
					{:else}
						{#each contrarianWins as h (h.marketId + h.settledAtMs)}
							<div class="dash-past-row dash-past-row-soft">
								<span class="res won">
									<Check aria-hidden="true" size={11} strokeWidth={3} />
								</span>
								<div>
									<div class="q">{marketById.get(h.marketId)?.title ?? h.marketId}</div>
									<div class="ctx">
										{t({ locale: $localeStore, key: 'dash.disclosure.contrarian_ctx' })}
									</div>
								</div>
								<span class="delta-pct delta-won">
									{t({
										locale: $localeStore,
										key: 'dash.disclosure.contrarian_amount',
										params: { vxp: h.vxp }
									})}
								</span>
							</div>
						{/each}
					{/if}
				{/snippet}
			</DashDisclosure>

			<DashDisclosure title={t({ locale: $localeStore, key: 'dash.disclosure.untried_title' })}>
				{#snippet body()}
					{#if untriedCategory}
						{@const label = t({
							locale: $localeStore,
							key: MARKET_TAG_LABEL_KEYS[untriedCategory]
						})}
						<p class="dash-suggest-q">
							{t({
								locale: $localeStore,
								key: 'dash.disclosure.untried_body',
								params: { category: label }
							})}
						</p>
						<button
							class="dash-suggest-cta"
							onclick={() => goto(resolve(AppPath.Flow))}
							type="button"
						>
							{t({
								locale: $localeStore,
								key: 'dash.disclosure.untried_cta',
								params: { category: label }
							})}
						</button>
					{:else}
						<p class="dash-suggest-q">
							{t({ locale: $localeStore, key: 'dash.disclosure.untried_empty' })}
						</p>
					{/if}
				{/snippet}
			</DashDisclosure>

			<div style:height="32px"></div>
		</div>
	{/if}
</PageScaffold>

<!-- ResolutionReveal — the deferred "being right" digest. Opened by the
     dashboard resolution banner; both CTAs acknowledge the batch. Rendered
     outside PageScaffold so its fixed full-screen overlay isn't clipped by
     the scroll container. -->
{#if revealOpen}
	<ResolutionReveal data={revealSnapshot} onDismiss={onRevealDismiss} onReview={onRevealReview} />
{/if}

<style lang="postcss">
	/* DashPage local hooks. Most class names live in `app.css`; this
	   block only carries small Svelte-only tweaks (delta-pct colour
	   modifiers). */

	:global(.dash-delta.dash-delta-pos) {
		color: var(--yes);
	}

	:global(.dash-delta.dash-delta-neg) {
		color: var(--no);
	}

	:global(.dash-delta.dash-delta-neutral) {
		color: var(--text-muted);
	}

	:global(.dash-past-row .delta-pct.delta-won) {
		color: var(--yes);
	}

	:global(.dash-past-row .delta-pct.delta-lost) {
		color: var(--no);
	}

	:global(.dash-rank-tile-btn) {
		appearance: none;
		cursor: pointer;
		text-align: left;
	}

	:global(.dash-past-row-soft) {
		padding: 8px 0;
		border-bottom-color: color-mix(in srgb, var(--text-base) 6%, transparent);
	}
</style>
