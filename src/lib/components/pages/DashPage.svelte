<script lang="ts">
	/**
	 * Dash screen — the user's at-a-glance accuracy + streak + recent
	 * activity surface. Backend fields that don't yet exist on the
	 * canister (rival, contrarian count, lifetime VXP, global rank, …)
	 * fall back to an em-dash placeholder rather than an approximation.
	 */
	import { Check, ChevronRight, X } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import DashAccuracySparkline from '$lib/components/dash/DashAccuracySparkline.svelte';
	import DashCategoryBreakdown from '$lib/components/dash/DashCategoryBreakdown.svelte';
	import DashDayZero from '$lib/components/dash/DashDayZero.svelte';
	import DashHeroAccuracy from '$lib/components/dash/DashHeroAccuracy.svelte';
	import DashHoldingsCard from '$lib/components/dash/DashHoldingsCard.svelte';
	import DashNextUnlock from '$lib/components/dash/DashNextUnlock.svelte';
	import DashOracleInsight from '$lib/components/dash/DashOracleInsight.svelte';
	import DashRankContext from '$lib/components/dash/DashRankContext.svelte';
	import PageScaffold from '$lib/components/layout/PageScaffold.svelte';
	import { ACHIEVEMENTS } from '$lib/constants/achievements.constants';
	import { EM_DASH, USD_DECIMALS, ZERO } from '$lib/constants/app.constants';
	import {
		MARKET_TAG_LABEL_KEYS,
		MARKET_TAGS,
		type MarketTag
	} from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { featuredEvent } from '$lib/derived/featured-event.derived';
	import { marketTags } from '$lib/derived/market-tags.derived';
	import { orders } from '$lib/derived/orders.derived';
	import { positions } from '$lib/derived/positions.derived';
	import { resolvedPositions } from '$lib/derived/resolved-positions.derived';
	import { worldCupActive } from '$lib/derived/world-cup.derived';
	import { safeGetIdentityOnce } from '$lib/services/identity.services';
	import { calculateAndSyncStats, getProfile } from '$lib/services/profile.services';
	import { loadMyUserStats } from '$lib/services/user-stats.services';
	import { balancesStore } from '$lib/stores/balances.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { marketsStore } from '$lib/stores/markets.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import type { UserStatsDoc } from '$lib/types/user-stats';
	import { decimalFixedValueToNumber } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import { formatVxpBalance } from '$lib/utils/playground-display.utils';
	import { inferResolvedOutcomeId } from '$lib/utils/resolved-position.utils';

	type TimeWindow = '7d' | '30d' | '90d' | 'All';
	type PastFilter = 'all' | 'won' | 'lost';

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

	let userStats = $state<UserStatsDoc | undefined>(undefined);

	let tw = $state<TimeWindow>('30d');
	let pastFilter = $state<PastFilter>('all');

	// Free VXP balance in the user's ICRC ledger account. Note this
	// drops to ~0 once VXP is moved into the clearing canister as
	// collateral, so a user with many active positions can show 0 here
	// despite owning plenty of VXP — see `holdingsTotal` below for the
	// combined free + backed number that the "Total Holdings" hero shows.
	const vxpBalance = $derived($balancesStore?.[VXP_TOKEN.id] ?? ZERO);

	// Backed = sum of locked collateral across the user's active positions
	// on VXP-denominated markets. `lockedCollateral` is in clearing-USD
	// micro-units (USD_DECIMALS = 4), which matches VXP_TOKEN.decimals,
	// so the same `formatVxpBalance` helper renders them at the right
	// scale without an extra conversion.
	const backedRaw = $derived.by((): bigint =>
		$positions.reduce<bigint>((acc, pos) => {
			const market = marketById.get(pos.marketId);

			if (market === undefined || market.token.symbol !== VXP_TOKEN.symbol) {
				return acc;
			}

			return acc + pos.lockedCollateral;
		}, ZERO)
	);
	const backedDisplay = $derived(formatVxpBalance({ value: backedRaw, decimals: USD_DECIMALS }));

	// Total holdings = free wallet balance + backed collateral. Both legs
	// already share a 4-decimal scale (`VXP_TOKEN.decimals` ==
	// `USD_DECIMALS`), so we can add raw bigints before formatting.
	// Without this, a user with all their VXP locked in active positions
	// would see "0 VXP" as their Total Holdings while "Backed" reads in
	// the thousands — the headline number must reflect everything they
	// own, not just the free portion.
	const holdingsTotalRaw = $derived(vxpBalance + backedRaw);
	const balanceDisplay = $derived(
		formatVxpBalance({ value: holdingsTotalRaw, decimals: VXP_TOKEN.decimals })
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

			return Number(b.totalVolume) - Number(a.totalVolume);
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

	// "Past predictions" row list. Reads from `$resolvedPositions` (the
	// uncapped clearing-event stream) and shapes each entry to the row
	// template's expected fields. Stays consistent with the chip counts
	// further up — same source, same scope.
	const filteredHistory = $derived(
		$resolvedPositions
			.filter((row) => {
				if (pastFilter === 'won') {
					return row.result === 'won';
				}

				if (pastFilter === 'lost') {
					return row.result === 'lost';
				}

				return row.result !== 'neutral';
			})
			.map((row) => {
				const market = marketById.get(row.marketId);
				const outcomeId = inferResolvedOutcomeId({ resolved: row, market });
				const sideLabel =
					outcomeId === undefined
						? null
						: (market?.outcomes?.find((o) => o.id === outcomeId)?.title ?? outcomeId);

				return {
					marketId: row.marketId,
					settledAtMs: Number(row.timestampNs / 1_000_000n),
					win: row.result === 'won',
					sideLabel,
					realizedPnlUsd: row.realizedPnlUsd
				};
			})
	);

	// `recentSettlements` (capped at `USER_STATS_RECENT_LIMIT`) used to be
	// combined with the broken lifetime `wins`/`losses` to render the
	// chip counts. Now that `wins`/`losses` are sourced from the
	// uncapped `$resolvedPositions` directly they're already complete,
	// so the separate "session" tallies are gone. The variable is kept
	// for the `sessionDelta` insight further up the file, which is a
	// distinct concept (accuracy delta in the recent window).

	// Best win for the Oracle insight — first WIN in recent
	// settlements, otherwise the first row, otherwise undefined.
	const bestWin = $derived(recentSettlements.find((s) => s.win) ?? recentSettlements[0]);
	const bestWinTitle = $derived(
		bestWin ? (marketById.get(bestWin.marketId)?.title ?? bestWin.marketId) : ''
	);

	// Contrarian wins — placeholder until the satellite tags each
	// settlement with a `contrarian` flag.
	const contrarianWins = $derived(recentSettlements.filter((s) => s.win).slice(0, 3));

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

	// ─── Formatters ────────────────────────────────────────────────────
	const fmtRelativeShort = (ms: number): string => {
		const delta = Date.now() - ms;
		const minutes = Math.floor(delta / 60_000);

		if (minutes < 60) {
			return `${Math.max(1, minutes)}m`;
		}

		const hours = Math.floor(minutes / 60);

		if (hours < 24) {
			return `${hours}h`;
		}

		const days = Math.floor(hours / 24);

		return `${days}d`;
	};

	/**
	 * Past-prediction row PnL → "+240 VXP" / "−180 VXP". `pnlUsdMicroUnits`
	 * is the signed `cashflow_usd` carried on the `Settled` event in
	 * `USD_DECIMALS` units; converted via `decimalFixedValueToNumber` and
	 * rounded to whole VXP for the row chip.
	 */
	const fmtPastRowAmount = (pnlUsdMicroUnits: bigint): string => {
		const n = decimalFixedValueToNumber({ value: pnlUsdMicroUnits, decimals: USD_DECIMALS });
		const sign = n >= 0 ? '+' : '−';

		return `${sign}${Math.round(Math.abs(n))} VXP`;
	};

	const fmtTimeLeft = (expiryMs: number): { label: string; urgent: boolean } => {
		const delta = expiryMs - Date.now();

		if (delta <= 0) {
			return { label: t({ locale: $localeStore, key: 'dash.active.closed' }), urgent: false };
		}

		const hours = Math.floor(delta / (1000 * 60 * 60));

		if (hours < 24) {
			return {
				label: t({
					locale: $localeStore,
					key: 'dash.active.hours_left',
					params: { count: Math.max(1, hours) }
				}),
				urgent: true
			};
		}

		const days = Math.floor(hours / 24);

		return {
			label: t({ locale: $localeStore, key: 'dash.active.days_left', params: { count: days } }),
			urgent: false
		};
	};

	const marketTitle = (marketId: string): string => marketById.get(marketId)?.title ?? marketId;
	const marketVolumeCalls = (m: Market): number => Number(m.totalVolume ?? ZERO);

	// ─── Closing-today urgency badge ───────────────────────────────────
	const closingTodayCount = $derived(
		activePositions.filter((entry) => fmtTimeLeft(Number(entry.market.expiryDate)).urgent).length
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
	});
</script>

<PageScaffold eyebrow={headerEyebrow} title={t({ locale: $localeStore, key: 'dash.title' })}>
	{#if isDay0 || isDay1Pending}
		<!-- ─── DAY 0 / DAY 1+ pending · forward-looking dashboard ─── -->
		<DashDayZero
			{backedDisplay}
			{balanceDisplay}
			compactMarkets={dayZeroCompact}
			day1={isDay1Pending}
			featuredMarket={dayZeroFeatured}
			firstCall={dayOneFirstCall}
		/>
	{:else}
		<div class="screen-scroll">
			<!--
				TODO(dash-1.4): mount the ResolutionReveal banner here. When a user
				returns with calls that settled while they were away, the standard
				Dashboard leads with a tappable "N calls settled · ±X VXP" banner
				(`.dash-reso-banner`, ported into app.css) that opens the
				ResolutionReveal sequence. ResolutionReveal is owned by the Flow
				entry / "while you were away" chunk (1.4); this banner is its only
				Dashboard mount point. Until 1.4 lands, no banner renders — the
				standard dashboard is otherwise complete. Wire here:
				`{#if maturedResolutions.count}` → `<button class="dash-reso-banner …">`.
			-->
			<!-- ─── HERO · accuracy ─── -->
			<DashHeroAccuracy
				{accuracyPct}
				{daysToMarathon}
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
				{backedDisplay}
				{balanceDisplay}
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
			<div class="dash-section">
				<div class="dash-section-eyebrow">
					<span>
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
					<a
						class="see-all"
						href={resolve(AppPath.Portfolio)}
						onclick={(e) => {
							e.preventDefault();
							goto(resolve(AppPath.Portfolio));
						}}
					>
						{t({
							locale: $localeStore,
							key: 'dash.active.see_all',
							params: { count: totalActive }
						})}
					</a>
				</div>
				{#if activePositions.length === 0}
					<div class="dash-empty">
						{t({ locale: $localeStore, key: 'dash.placeholder.positions' })}
					</div>
				{:else}
					{#each activePositions as entry, i (entry.position.marketId)}
						{@const m = entry.market}
						{@const side = entry.position.outcomeId === 'YES' ? 'YES' : 'NO'}
						{@const prob = side === 'YES' ? m.yesProbability : 1 - m.yesProbability}
						{@const currentPct = Math.round(prob * 100)}
						{@const timer = fmtTimeLeft(Number(m.expiryDate))}
						<button
							class="dash-pos-row"
							onclick={() => goto(resolve(`${AppPath.Markets}/${m.id}`))}
						>
							<div class="left">
								<div class="q">{m.title}</div>
								<div class="ctx">
									<span class="side {side.toLowerCase()}">{side}</span>
									<span>
										{t({
											locale: $localeStore,
											key: 'dash.active.vol_calls',
											params: { count: marketVolumeCalls(m) }
										})}
									</span>
								</div>
							</div>
							<div class="right-col">
								<span class="pct">{currentPct}%</span>
								<span class="timer" class:urgent={i === 0 && timer.urgent}>{timer.label}</span>
							</div>
						</button>
					{/each}
				{/if}
			</div>

			<!-- ─── BY CATEGORY breakdown ─── -->
			<!-- Hidden during World-Cup mode: per-category accuracy is empty
		     when play is scoped to the event. -->
			{#if !$worldCupActive}
				<DashCategoryBreakdown {catRows} />
			{/if}

			<!-- ─── RANK CONTEXT ─── -->
			<DashRankContext topCategory={catRows[0]} {wcAccuracy} worldCupActive={$worldCupActive} />

			<!-- ─── ORACLE INSIGHT ─── -->
			<DashOracleInsight {bestWinTitle} hasBestWin={Boolean(bestWin)} />

			<!-- ─── PAST predictions ─── -->
			<div class="dash-section">
				<div class="dash-section-eyebrow">
					<span>{t({ locale: $localeStore, key: 'dash.past.eyebrow' })}</span>
					<span class="see-all">
						{t({ locale: $localeStore, key: 'dash.past.total', params: { count: settledTotal } })}
					</span>
				</div>
				<div class="dash-filter-chips">
					<button
						class:active={pastFilter === 'all'}
						onclick={() => (pastFilter = 'all')}
						type="button"
					>
						{t({ locale: $localeStore, key: 'dash.past.filter_all' })}
					</button>
					<button
						class:active={pastFilter === 'won'}
						onclick={() => (pastFilter = 'won')}
						type="button"
					>
						{t({
							locale: $localeStore,
							key: 'dash.past.filter_won',
							params: { count: wins }
						})}
					</button>
					<button
						class:active={pastFilter === 'lost'}
						onclick={() => (pastFilter = 'lost')}
						type="button"
					>
						{t({
							locale: $localeStore,
							key: 'dash.past.filter_lost',
							params: { count: losses }
						})}
					</button>
				</div>
				<div>
					{#if filteredHistory.length === 0}
						<div class="dash-empty">{t({ locale: $localeStore, key: 'dash.past.empty' })}</div>
					{:else}
						{#each filteredHistory.slice(0, 8) as h (h.marketId + h.settledAtMs)}
							{@const won = h.win}
							{@const pnlPositive = h.realizedPnlUsd >= ZERO}
							<div class="dash-past-row">
								<span class="res" class:lost={!won} class:won>
									{#if won}
										<Check aria-hidden="true" size={11} strokeWidth={3} />
									{:else}
										<X aria-hidden="true" size={11} strokeWidth={3} />
									{/if}
								</span>
								<div>
									<div class="q">{marketTitle(h.marketId)}</div>
									<div class="ctx">
										{#if h.sideLabel !== null}
											{t({
												locale: $localeStore,
												key: 'dash.past.row_ctx_side_when',
												params: {
													side: h.sideLabel,
													when: fmtRelativeShort(h.settledAtMs)
												}
											})}
										{:else}
											{t({
												locale: $localeStore,
												key: 'dash.past.row_ctx_when',
												params: { when: fmtRelativeShort(h.settledAtMs) }
											})}
										{/if}
									</div>
								</div>
								<span
									class="delta-pct"
									class:delta-lost={!pnlPositive}
									class:delta-won={pnlPositive}
								>
									{fmtPastRowAmount(h.realizedPnlUsd)}
								</span>
							</div>
						{/each}
					{/if}
				</div>
			</div>

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
			<details class="dash-disclosure">
				<summary>
					<span>{t({ locale: $localeStore, key: 'dash.disclosure.rival_title' })}</span>
					<ChevronRight aria-hidden="true" size={12} strokeWidth={1.8} />
				</summary>
				<div class="dash-disclosure-body">
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
				</div>
			</details>

			<details class="dash-disclosure">
				<summary>
					<span>
						{t({
							locale: $localeStore,
							key: 'dash.disclosure.contrarian_title',
							params: { count: contrarianWins.length }
						})}
					</span>
					<ChevronRight aria-hidden="true" size={12} strokeWidth={1.8} />
				</summary>
				<div class="dash-disclosure-body">
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
									<div class="q">{marketTitle(h.marketId)}</div>
									<div class="ctx">
										{t({ locale: $localeStore, key: 'dash.disclosure.contrarian_ctx' })}
									</div>
								</div>
								<span class="delta-pct delta-won">+{EM_DASH} VXP</span>
							</div>
						{/each}
					{/if}
				</div>
			</details>

			<details class="dash-disclosure">
				<summary>
					<span>{t({ locale: $localeStore, key: 'dash.disclosure.untried_title' })}</span>
					<ChevronRight aria-hidden="true" size={12} strokeWidth={1.8} />
				</summary>
				<div class="dash-disclosure-body">
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
				</div>
			</details>

			<div style:height="32px"></div>
		</div>
	{/if}
</PageScaffold>

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
		border-bottom-color: rgba(242, 236, 220, 0.06);
	}
</style>
