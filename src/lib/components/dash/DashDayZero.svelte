<script lang="ts">
	/**
	 * Day-0 / Day-1 Dashboard — the forward-looking variant shown before a
	 * user has any *resolved* calls. It mirrors the standard Dashboard's
	 * section order but swaps every zero-data block for orientation copy:
	 *
	 * - **Day 0** (`day1 === false`): brand-new account, no calls placed.
	 *   Latin hero epigram + "make your first call" CTA, starter-pack
	 *   holdings, a pending accuracy-trend placeholder, three pinned
	 *   "Today in Flow" markets, a "Where you stand" rank grid, and a
	 *   locked Oracle tease.
	 * - **Day 1+ pending** (`day1 === true`): first call placed but not yet
	 *   settled. The hero reframes as "your call is in flight", Holdings
	 *   shows the available/backed/lifetime breakdown, and the Flow section
	 *   collapses to a single open-position card. A "Past predictions"
	 *   pending block is appended.
	 *
	 * Data comes from the real stores: holdings/backed from the wallet +
	 * clearing collateral, the open position from `$positions`, and the
	 * pinned markets from `$markets` (the featured event's markets first,
	 * then any open market) — never mocked.
	 */
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppPath } from '$lib/constants/routes.constants';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Market } from '$lib/types/market';
	import { t } from '$lib/utils/i18n.utils';

	interface FirstCall {
		market: Market;
		side: 'YES' | 'NO';
		stakeVxp: number;
	}

	interface Props {
		/** `false` → Day 0 (no calls); `true` → Day 1+ (call placed, unresolved). */
		day1: boolean;
		/** Free + backed VXP, already formatted for display (e.g. "1,000"). */
		balanceDisplay: string;
		/** Backed VXP for the Day-1 sub-stat, formatted (e.g. "100"). */
		backedDisplay: string;
		/** Free wallet VXP, formatted (e.g. "900") — used for the Available sub-stat. */
		freeBalanceDisplay: string;
		/** Featured pinned market (Day 0 only) — the large tap-to-Flow card. */
		featuredMarket: Market | undefined;
		/** Two compact pinned markets shown beneath the featured one (Day 0). */
		compactMarkets: Market[];
		/** The user's single open position (Day 1+ only). */
		firstCall: FirstCall | undefined;
		/** Number of live (unresolved) calls/orders — drives plural-aware badge copy. */
		pendingCount: number;
	}

	let {
		day1,
		balanceDisplay,
		backedDisplay,
		freeBalanceDisplay,
		featuredMarket,
		compactMarkets,
		firstCall,
		pendingCount
	}: Props = $props();

	const openFlow = (): void => {
		goto(resolve(AppPath.Flow));
	};

	const openMarket = (market: Market): void => {
		goto(resolve(`${AppPath.Markets}/${market.id}`));
	};

	// Crowd YES probability as a whole-percent integer, from live market
	// consensus rather than a hardcoded narrative number.
	const yesPct = (market: Market): number => Math.round(market.yesProbability * 100);

	// Actual count of "Today in Flow" markets rendered — 1 featured + up to 2
	// compact — so the header badge reflects the real list, not a hardcoded 3.
	const todayInFlowCount = $derived((featuredMarket !== undefined ? 1 : 0) + compactMarkets.length);

	// Open-position reframe (Day 1+): lead with the payout multiplier on the
	// user's side, not the raw market %. A first-time user reading "18%" on
	// their own YES call reads it as having picked wrong; "5.5×" with the
	// crowd % as caption keeps the signal while framing the upside.
	const firstCallMultiplier = $derived.by<string>(() => {
		if (firstCall === undefined) {
			return '—';
		}

		const yes = firstCall.market.yesProbability;
		const pSide = firstCall.side === 'YES' ? yes : 1 - yes;

		if (pSide <= 0) {
			return '—';
		}

		const mult = 1 / pSide;

		return `${mult >= 10 ? mult.toFixed(0) : mult.toFixed(1)}×`;
	});
	const firstCallCrowdPct = $derived(
		firstCall === undefined ? undefined : yesPct(firstCall.market)
	);
</script>

<div class="screen-scroll">
	<!-- ─── HERO · Latin frame + primary CTA into Flow ─── -->
	<div class="dash-hero">
		<span class="dash-ey">
			{t({
				locale: $localeStore,
				key: day1 ? 'dash.dz.hero_eyebrow_day1' : 'dash.dz.hero_eyebrow_day0'
			})}
		</span>
		<div class="dz-hero-quote">
			{t({
				locale: $localeStore,
				key: day1 ? 'dash.dz.hero_quote_day1' : 'dash.dz.hero_quote_day0'
			})}
		</div>
		<div class="dz-hero-trans">
			{t({
				locale: $localeStore,
				key: day1 ? 'dash.dz.hero_trans_day1' : 'dash.dz.hero_trans_day0'
			})}
		</div>
		<button class="dz-hero-cta" onclick={openFlow} type="button">
			<span>
				{t({ locale: $localeStore, key: day1 ? 'dash.dz.hero_cta_day1' : 'dash.dz.hero_cta_day0' })}
			</span>
			<span aria-hidden="true">→</span>
		</button>
		<div class="dz-hero-foot">
			{#if day1}
				{t({
					locale: $localeStore,
					key: 'dash.dz.hero_foot_day1',
					params: { count: pendingCount, balance: freeBalanceDisplay }
				})}
			{:else}
				{t({ locale: $localeStore, key: 'dash.dz.hero_foot_day0' })}
			{/if}
		</div>
	</div>

	<!-- ─── HOLDINGS · Day 0 = starter pack; Day 1+ = breakdown ─── -->
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
				{#if day1}
					<div class="dash-sub-stats">
						<div class="dash-sub-stat">
							<span class="lbl">{t({ locale: $localeStore, key: 'dash.dz.available' })}</span>
							<span class="val">{freeBalanceDisplay}</span>
						</div>
						<div class="dash-sub-stat">
							<span class="lbl">{t({ locale: $localeStore, key: 'dash.holdings.backed' })}</span>
							<span class="val dz-val-accent">{backedDisplay}</span>
						</div>
						<div class="dash-sub-stat">
							<span class="lbl">{t({ locale: $localeStore, key: 'dash.holdings.lifetime' })}</span>
							<span class="val">{t({ locale: $localeStore, key: 'dash.dz.lifetime_zero' })}</span>
						</div>
					</div>
				{:else}
					<div class="dz-holdings-caption">
						{t({ locale: $localeStore, key: 'dash.dz.holdings_caption' })}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- ─── ACCURACY TREND · placeholder with resolve anchor ─── -->
	<div class="dash-section">
		<div class="dash-section-eyebrow">
			<span>{t({ locale: $localeStore, key: 'dash.trend.eyebrow' })}</span>
			<span class="see-all">
				{t({
					locale: $localeStore,
					key: day1 ? 'dash.dz.trend_tag_day1' : 'dash.dz.trend_tag_day0'
				})}
			</span>
		</div>
		<div class="dash-chart-card">
			<div class="dz-trend-placeholder">
				<div class="quote">
					{t({
						locale: $localeStore,
						key: day1 ? 'dash.dz.trend_quote_day1' : 'dash.dz.trend_quote_day0'
					})}
				</div>
				<div class="body">
					{t({
						locale: $localeStore,
						key: day1 ? 'dash.dz.trend_body_day1' : 'dash.dz.trend_body_day0'
					})}
				</div>
			</div>
		</div>
	</div>

	<!-- ─── ACTIVE · Day 1+ open position, else Day 0 pinned markets ─── -->
	<div class="dash-section">
		{#if day1 && firstCall !== undefined}
			<div class="dash-section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'dash.active.eyebrow' })}</span>
				<span class="see-all"
					>{t({
						locale: $localeStore,
						key: 'dash.dz.n_open',
						params: { count: pendingCount }
					})}</span
				>
			</div>
			<button class="dz-open-pos" onclick={() => openMarket(firstCall.market)} type="button">
				<div>
					<div class="q">{firstCall.market.title}</div>
					<div class="ctx">
						<span class="side {firstCall.side.toLowerCase()}">{firstCall.side}</span>
						<span>
							{t({
								locale: $localeStore,
								key: 'dash.dz.open_pos_ctx',
								params: { stake: firstCall.stakeVxp }
							})}
						</span>
					</div>
				</div>
				<div class="right">
					<span class="pct">{firstCallMultiplier}</span>
					<span class="timer">
						{firstCallCrowdPct === undefined
							? t({ locale: $localeStore, key: 'dash.dz.open_pos_payout_unknown' })
							: t({
									locale: $localeStore,
									key: 'dash.dz.open_pos_payout',
									params: { pct: firstCallCrowdPct }
								})}
					</span>
				</div>
			</button>
		{:else if day1}
			<!-- Day-1 state: call(s) placed but firstCall position not yet available
			     from the positions store (e.g. limit order resting, or positions
			     still loading). Show a pending placeholder rather than the Day-0
			     starter-markets UI, which would be misleading given the copy already
			     says "your call is in flight". -->
			<div class="dash-section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'dash.active.eyebrow' })}</span>
				<span class="see-all"
					>{t({
						locale: $localeStore,
						key: 'dash.dz.n_open',
						params: { count: pendingCount }
					})}</span
				>
			</div>
			<div class="dz-past-empty">
				<div class="body">
					{t({ locale: $localeStore, key: 'dash.dz.active_day1_pending_body' })}
				</div>
			</div>
		{:else}
			<div class="dash-section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'dash.dz.today_in_flow' })}</span>
				<button class="see-all dz-see-all-btn" onclick={openFlow} type="button">
					{t({
						locale: $localeStore,
						key: 'dash.dz.open_count',
						params: { count: todayInFlowCount }
					})}
				</button>
			</div>
			{#if featuredMarket !== undefined}
				{@const fYes = yesPct(featuredMarket)}
				<button class="dz-pinned" onclick={openFlow} type="button">
					<div class="tag">{t({ locale: $localeStore, key: 'dash.dz.pinned_tag' })}</div>
					<div class="q">{featuredMarket.title}</div>
					<div class="dz-pinned-consensus">
						<span class="lbl">
							{t({ locale: $localeStore, key: 'dash.dz.crowd_yes', params: { pct: fYes } })}
						</span>
					</div>
					<div class="bar"><div style:width="{fYes}%" class="fill"></div></div>
					<div class="ctx">
						<span>{t({ locale: $localeStore, key: 'dash.dz.tap_to_call' })}</span>
						<span class="go" aria-hidden="true">→</span>
					</div>
				</button>
			{/if}
			{#each compactMarkets as market (market.id)}
				{@const cYes = yesPct(market)}
				<button class="dz-pinned-compact" onclick={openFlow} type="button">
					<div class="cq">{market.title}</div>
					<span class="cyn"
						><span class="y">{cYes}%</span> / <span class="n">{100 - cYes}%</span></span
					>
					<span class="cgo" aria-hidden="true">→</span>
				</button>
			{/each}
		{/if}
	</div>

	<!-- ─── WHERE YOU STAND · rank tiles ─── -->
	<div class="dash-section">
		<div class="dash-section-eyebrow">
			<span>{t({ locale: $localeStore, key: 'dash.rank.eyebrow' })}</span>
		</div>
		<div class="dash-rank-grid">
			<div class="dash-rank-tile">
				<span class="lbl">{t({ locale: $localeStore, key: 'dash.rank.global' })}</span>
				<span class="v dz-v-mute">{t({ locale: $localeStore, key: 'dash.rank.placeholder' })}</span>
				<span class="sub">
					{t({
						locale: $localeStore,
						key: day1 ? 'dash.dz.rank_global_sub_day1' : 'dash.dz.rank_global_sub_day0'
					})}
				</span>
			</div>
			<button
				class="dash-rank-tile dash-rank-tile-btn"
				onclick={() => goto(resolve(AppPath.Arena))}
				type="button"
			>
				<span class="lbl">{t({ locale: $localeStore, key: 'dash.dz.rank_alma_mater' })}</span>
				<span class="v dz-v-mute">{t({ locale: $localeStore, key: 'dash.dz.rank_pick' })}</span>
				<span class="sub">{t({ locale: $localeStore, key: 'dash.dz.rank_alma_mater_sub' })}</span>
			</button>
			<div class="dash-rank-tile">
				<span class="lbl">{t({ locale: $localeStore, key: 'dash.dz.rank_best_cat' })}</span>
				<span class="v dz-v-serif">{t({ locale: $localeStore, key: 'dash.rank.placeholder' })}</span
				>
				<span class="sub">{t({ locale: $localeStore, key: 'dash.dz.rank_best_cat_sub' })}</span>
			</div>
		</div>
	</div>

	<!-- ─── ORACLE · locked tease ─── -->
	<div class="dash-section">
		<div class="dz-oracle-locked">
			<span class="lbl">{t({ locale: $localeStore, key: 'dash.dz.oracle_locked_label' })}</span>
			<p class="q">{t({ locale: $localeStore, key: 'dash.dz.oracle_locked_quote' })}</p>
			<span class="sub">{t({ locale: $localeStore, key: 'dash.dz.oracle_locked_sub' })}</span>
		</div>
	</div>

	<!-- ─── PAST · Day 1+ only · Day 0 stays clean (hero already orients) ─── -->
	{#if day1}
		<div class="dash-section">
			<div class="dash-section-eyebrow">
				<span>{t({ locale: $localeStore, key: 'dash.past.eyebrow' })}</span>
				<span class="see-all"
					>{t({
						locale: $localeStore,
						key: 'dash.dz.n_pending',
						params: { count: pendingCount }
					})}</span
				>
			</div>
			<div class="dz-past-empty">
				<div class="q">{t({ locale: $localeStore, key: 'dash.dz.past_empty_quote' })}</div>
				<div class="body">{t({ locale: $localeStore, key: 'dash.dz.past_empty_body' })}</div>
			</div>
		</div>
	{/if}

	<div style:height="32px"></div>
</div>

<style lang="postcss">
	/* Day-0/1-only colour modifiers layered over the shared `.dash-*` /
	   `.dz-*` classes in `app.css`. Scoped to this component via :global
	   on the shared class names it owns the markup for. */
	:global(.dash-sub-stat .val.dz-val-accent) {
		color: var(--accent);
	}

	:global(.dash-rank-tile .v.dz-v-mute) {
		color: var(--text-muted);
	}

	:global(.dash-rank-tile .v.dz-v-serif) {
		color: var(--text-muted);
		font-family: var(--font-serif);
		font-style: italic;
	}

	:global(.dz-see-all-btn) {
		appearance: none;
		border: 0;
		background: none;
		padding: 0;
		cursor: pointer;
		font: inherit;
		color: var(--accent);
	}
</style>
