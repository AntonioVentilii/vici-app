<script lang="ts">
	/**
	 * Dash screen — the user's at-a-glance accuracy + streak + recent
	 * activity surface. Backend fields that don't yet exist on the
	 * canister (rival, contrarian count, lifetime VXP, global rank, …)
	 * fall back to an em-dash placeholder rather than an approximation.
	 */
	import {
		ArrowDown,
		ArrowUp,
		Check,
		ChevronRight,
		Flame,
		Gift,
		Sparkles,
		X
	} from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import DashAccuracySparkline from '$lib/components/dash/DashAccuracySparkline.svelte';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import { ACHIEVEMENTS } from '$lib/constants/achievements.constants';
	import { USD_DECIMALS, ZERO } from '$lib/constants/app.constants';
	import {
		MARKET_TAG_LABEL_KEYS,
		MARKET_TAGS,
		primaryMarketTag,
		type MarketTag
	} from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { marketTags } from '$lib/derived/market-tags.derived';
	import { orders } from '$lib/derived/orders.derived';
	import { positions } from '$lib/derived/positions.derived';
	import { resolvedPositions } from '$lib/derived/resolved-positions.derived';
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
	const EM_DASH = '—';
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

	/**
	 * Per-category accuracy breakdown. One row per tag with at least one
	 * settled call. Sourced from `$resolvedPositions` (the FE-side
	 * Settled-event stream) so it stays in lock-step with the chip
	 * counts in the "Past predictions" block above.
	 *
	 * 0%-accuracy rows are hidden — a single early loss shouldn't paint
	 * the whole category red while the user has no signal yet.
	 */
	const catRows = $derived<CategoryRow[]>(
		MARKET_TAGS.filter((tag) => tag !== 'wc')
			.map((tag): CategoryRow => {
				const settled = $resolvedPositions.filter(
					(r) => primaryMarketTag($marketTags[r.marketId]) === tag
				);

				const wins = settled.filter((r) => r.result === 'won').length;
				const acc = settled.length > 0 ? wins / settled.length : 0;

				return {
					id: tag,
					label: t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[tag] }),
					acc
				};
			})
			.filter((row) => row.acc > 0)
			.sort((a, b) => b.acc - a.acc)
	);

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

	// Markets the user hasn't tried — pick the first category that the
	// user has zero positions in (active or settled). Sourced directly
	// from `$positions` + `$resolvedPositions` so a category counts as
	// "tried" even when nothing's resolved in it yet (the By-category
	// block doesn't surface those, but they shouldn't show up as
	// untried suggestions either).
	const triedCategoryIds = $derived.by<readonly MarketTag[]>(() => {
		const tags: MarketTag[] = [];

		const collect = (marketId: string) => {
			const tag = primaryMarketTag($marketTags[marketId]);

			if (tag !== undefined && tag !== 'wc' && !tags.includes(tag)) {
				tags.push(tag);
			}
		};

		for (const p of $positions) {
			collect(p.marketId);
		}

		for (const r of $resolvedPositions) {
			collect(r.marketId);
		}

		return tags;
	});
	const untriedCategory = $derived<MarketTag | undefined>(
		MARKET_TAGS.filter((tag) => tag !== 'wc').find((tag) => !triedCategoryIds.includes(tag))
	);

	/** Highest-accuracy category — first row of the already-sorted list. */
	const bestCategory = $derived(catRows[0]);

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

	const stripWillPrefix = (title: string): string =>
		title.replace(/^Will\s+/i, '').replace(/\?\s*$/, '');

	const marketTitle = (marketId: string): string => marketById.get(marketId)?.title ?? marketId;
	const marketVolumeCalls = (m: Market): number => Number(m.totalVolume ?? ZERO);

	// ─── Closing-today urgency badge ───────────────────────────────────
	const closingTodayCount = $derived(
		activePositions.filter((entry) => fmtTimeLeft(Number(entry.market.expiryDate)).urgent).length
	);

	// ─── Time window strip (visual switch only) ────────────────────────
	const windows: TimeWindow[] = ['7d', '30d', '90d', 'All'];

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

<div class="screen-scroll">
	<!-- ─── HERO · accuracy ─── -->
	<div class="dash-hero">
		<span class="dash-ey">{t({ locale: $localeStore, key: 'dash.accuracy.eyebrow' })}</span>
		<div class="dash-big">
			{accuracyPct}<span class="dash-unit">%</span>
		</div>
		<div class="dash-meta-row">
			{#if sessionDelta != null}
				{@const isPos = sessionDelta >= 0}
				<span class="dash-delta" class:dash-delta-neg={!isPos} class:dash-delta-pos={isPos}>
					{#if isPos}
						<ArrowUp aria-hidden="true" size={10} strokeWidth={2.5} />
					{:else}
						<ArrowDown aria-hidden="true" size={10} strokeWidth={2.5} />
					{/if}
					{t({
						locale: $localeStore,
						key: isPos ? 'dash.accuracy.session_delta_pos' : 'dash.accuracy.session_delta_neg',
						params: { value: isPos ? sessionDelta : Math.abs(sessionDelta) }
					})}
				</span>
			{:else}
				<span class="dash-delta dash-delta-neutral">
					<Sparkles aria-hidden="true" size={10} strokeWidth={2} />
					{nickname
						? t({
								locale: $localeStore,
								key: 'dash.accuracy.signed_in_short',
								params: { handle: nickname }
							})
						: t({ locale: $localeStore, key: 'dash.accuracy.first_session' })}
				</span>
			{/if}
			<span class="dash-anchor">
				{t({ locale: $localeStore, key: 'dash.accuracy.global_anchor' })}
			</span>
		</div>
		<div class="dash-streak-row">
			<div class="dash-streak-pair">
				<span class="dash-flame" aria-hidden="true">
					<Flame size={20} strokeWidth={2} />
				</span>
				<div>
					<span class="dash-streak-big">
						{t({
							locale: $localeStore,
							key: 'dash.streak.days',
							params: { count: streak }
						})}
					</span>
					<span class="dash-streak-sub">
						{t({
							locale: $localeStore,
							key: 'dash.streak.longest_to_marathon_em',
							params: { count: daysToMarathon }
						})}
					</span>
				</div>
			</div>
			<div class="dash-streak-bar">
				<span style:width="{streakBarPct}%" class="fill"></span>
			</div>
		</div>
	</div>

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
	<div class="dash-section">
		<div class="dash-holdings">
			<div class="dash-holdings-top">
				<span class="dash-ey">{t({ locale: $localeStore, key: 'dash.holdings.eyebrow' })}</span>
				<span class="dash-purpose">
					{t({ locale: $localeStore, key: 'dash.holdings.purpose' })}
				</span>
				<div class="dash-balance">
					{balanceDisplay}<span class="unit">VXP</span>
				</div>
				<div class="dash-sub-stats">
					<div class="dash-sub-stat">
						<span class="lbl">
							{t({ locale: $localeStore, key: 'dash.holdings.backed' })}
						</span>
						<span class="val">{backedDisplay}</span>
					</div>
					<div class="dash-sub-stat">
						<span class="lbl">
							{t({ locale: $localeStore, key: 'dash.holdings.lifetime' })}
						</span>
						<span class="val">{lifetimeDisplay}</span>
					</div>
					<div class="dash-sub-stat">
						<span class="lbl">
							{t({ locale: $localeStore, key: 'dash.holdings.session' })}
						</span>
						<span class="val">
							{t({
								locale: $localeStore,
								key:
									recentSettlements.length === 1
										? 'dash.holdings.session_one'
										: 'dash.holdings.session_many',
								params: { count: recentSettlements.length }
							})}
						</span>
					</div>
				</div>
			</div>
			<a
				class="dash-referral"
				href={resolve(AppPath.Social)}
				onclick={(e) => {
					e.preventDefault();
					goto(resolve(AppPath.Social));
				}}
			>
				<div class="left">
					<span class="gift" aria-hidden="true">
						<Gift size={12} strokeWidth={1.8} />
					</span>
					<div class="text">
						<span class="h">
							{t({ locale: $localeStore, key: 'dash.holdings.invite_title' })}
						</span>
						<span class="s">
							{t({ locale: $localeStore, key: 'dash.holdings.invite_sub' })}
						</span>
					</div>
				</div>
				<span class="arrow">
					{t({ locale: $localeStore, key: 'dash.holdings.invite_cta' })}
				</span>
			</a>
		</div>
	</div>

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
				{t({ locale: $localeStore, key: 'dash.active.see_all', params: { count: totalActive } })}
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
				<button class="dash-pos-row" onclick={() => goto(resolve(`${AppPath.Markets}/${m.id}`))}>
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
	<div class="dash-section">
		<div class="dash-section-eyebrow">
			<span>{t({ locale: $localeStore, key: 'dash.categories.eyebrow' })}</span>
		</div>
		{#if catRows.length === 0}
			<div class="dash-empty">
				{t({ locale: $localeStore, key: 'dash.placeholder.categories' })}
			</div>
		{:else}
			{#each catRows as r (r.id)}
				{@const pct = Math.round(r.acc * 100)}
				<div class="dash-cat-row">
					<span class="name">{r.label}</span>
					<div class="bar"><span style:width="{pct}%" class="fill"></span></div>
					<span class="pct">{pct}%</span>
				</div>
			{/each}
		{/if}
	</div>

	<!-- ─── RANK CONTEXT ─── -->
	<div class="dash-section">
		<div class="dash-section-eyebrow">
			<span>{t({ locale: $localeStore, key: 'dash.rank.eyebrow' })}</span>
		</div>
		<div class="dash-rank-grid">
			<div class="dash-rank-tile">
				<span class="lbl">{t({ locale: $localeStore, key: 'dash.rank.global' })}</span>
				<span class="v">{EM_DASH}</span>
				<span class="sub">{t({ locale: $localeStore, key: 'dash.rank.global_sub' })}</span>
			</div>
			<button
				class="dash-rank-tile dash-rank-tile-btn"
				onclick={() => goto(resolve(AppPath.Social))}
				type="button"
			>
				<span class="lbl">{t({ locale: $localeStore, key: 'dash.rank.league' })}</span>
				<span class="v">{EM_DASH}</span>
				<span class="sub">{t({ locale: $localeStore, key: 'dash.rank.league_sub' })}</span>
			</button>
			<div class="dash-rank-tile">
				<span class="lbl">
					{#if bestCategory}{bestCategory.label}{:else}{t({
							locale: $localeStore,
							key: 'dash.rank.top_cat'
						})}{/if}
				</span>
				<span class="v acc">
					{#if bestCategory}
						{Math.round(bestCategory.acc * 100)}%
					{:else}
						{EM_DASH}
					{/if}
				</span>
				<span class="sub">{t({ locale: $localeStore, key: 'dash.rank.top_cat_sub' })}</span>
			</div>
		</div>
	</div>

	<!-- ─── ORACLE INSIGHT ─── -->
	<div class="dash-section">
		<div class="dash-oracle">
			<span class="lbl">{t({ locale: $localeStore, key: 'dash.oracle.eyebrow' })}</span>
			{#if bestWin}
				<p class="q">
					{t({
						locale: $localeStore,
						key: 'dash.oracle.best_call',
						params: { title: stripWillPrefix(bestWinTitle) }
					})}
				</p>
				<span class="sub">
					{t({ locale: $localeStore, key: 'dash.oracle.best_call_sub' })}
				</span>
			{:else}
				<p class="q">{t({ locale: $localeStore, key: 'dash.oracle.empty' })}</p>
				<span class="sub">{t({ locale: $localeStore, key: 'dash.oracle.empty_sub' })}</span>
			{/if}
		</div>
	</div>

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
						<span class="delta-pct" class:delta-lost={!pnlPositive} class:delta-won={pnlPositive}>
							{fmtPastRowAmount(h.realizedPnlUsd)}
						</span>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- ─── NEXT UNLOCK ─── -->
	{#if nextAchievement}
		<div class="dash-section">
			<div class="dash-section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'dash.next.eyebrow' })}</span>
			</div>
			<button class="dash-achv" onclick={() => goto(resolve(AppPath.Album))} type="button">
				<span class="em" aria-hidden="true">{nextAchievement.emblem}</span>
				<div class="body">
					<div class="name">{t({ locale: $localeStore, key: nextAchievement.nameKey })}</div>
					<div class="progress"><span style:width="{streakBarPct}%" class="fill"></span></div>
					<div class="pct">
						{t({
							locale: $localeStore,
							key: 'dash.next.streak_progress',
							params: { current: streak, target: MARATHON_DAYS, count: daysToMarathon }
						})}
					</div>
				</div>
			</button>
		</div>
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
				{@const label = t({ locale: $localeStore, key: MARKET_TAG_LABEL_KEYS[untriedCategory] })}
				<p class="dash-suggest-q">
					{t({
						locale: $localeStore,
						key: 'dash.disclosure.untried_body',
						params: { category: label }
					})}
				</p>
				<button class="dash-suggest-cta" onclick={() => goto(resolve(AppPath.Flow))} type="button">
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
