<script lang="ts">
	import { LineChart } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import OpenOrdersTable from '$lib/components/portfolio/OpenOrdersTable.svelte';
	import PositionArtThumb from '$lib/components/portfolio/PositionArtThumb.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { primaryMarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { marketTags } from '$lib/derived/market-tags.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { orders, ordersNotInitialized } from '$lib/derived/orders.derived';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { positions, positionsNotInitialized } from '$lib/derived/positions.derived';
	import { tradeHistory, tradeHistoryNotInitialized } from '$lib/derived/trade-history.derived';
	import { balancesStore } from '$lib/stores/balances.store';
	import { localeStore } from '$lib/stores/locale.store';
	import type { Position } from '$lib/types/position';
	import { t } from '$lib/utils/i18n.utils';
	import {
		formatPositionPnLWithOptionalUnit,
		formatVxpBalance
	} from '$lib/utils/playground-display.utils';
	import { calculatePositionPnL } from '$lib/utils/portfolio.utils';
	import { positionResolvedResult } from '$lib/utils/position.utils';
	import { refreshOrders, refreshPositions } from '$lib/utils/refresh.utils';

	/**
	 * Portfolio — single-page hero + flat lists, matching `PortfolioScreen`
	 * in `screens.jsx:716`.
	 *
	 * Layout
	 * - `MobileAppBar` with title "Portfolio" and a chart icon on the
	 *   right slot (replaces the legacy `SectionHeader` + description).
	 * - Hero card (centered) — `LIFETIME VXP` eyebrow, 48px VXP balance
	 *   from `balancesStore[VXP]`, weekly delta line in laurel / no-red
	 *   (matches the Wallet hero pattern shipped in `2b48623`).
	 * - 3-col mini-stats: Active calls / Resolved / Lifetime VXP (the
	 *   audit's chosen interpretation; replaces the legacy
	 *   `PortfolioStats` 6-tile holdings card).
	 * - Open positions — flat list, each row: category tag · side ·
	 *   market title · entry → current %· signed PnL. Tap routes to the
	 *   market detail.
	 * - Resolved positions — flat list, each row: W/L glyph · market
	 *   title · signed PnL.
	 * - C-25 (production keep) — `OpenOrdersTable` retained for limit
	 *   orders.
	 *
	 * Removed in this pass: `PortfolioStats` (replaced by the hero + 3-
	 * col mini-stats), `PortfolioAllocation` (the prototype's 5-bucket
	 * allocation grid is editorial and not part of the new hero spec),
	 * `PositionTable` (split into the open / resolved flat lists),
	 * `TradeHistoryTable` (clearing-event view lives on Wallet's history
	 * tab; portfolio surface keeps its scope to positions + orders).
	 */

	// Cold-load spinner replaced by an inline empty / loading shimmer —
	// the prototype renders immediately and `<Loaders />` polls in the
	// background; this matches the Wallet hero behaviour.
	const refreshing = $derived(
		$positionsNotInitialized ||
			$tradeHistoryNotInitialized ||
			$marketsNotInitialized ||
			$ordersNotInitialized
	);

	const onOrdersRefresh = () => {
		refreshOrders();
		refreshPositions();
	};

	const getMarketById = (id: string) => $markets.find((m) => m.id === id);

	const getCategoryId = (marketId: string): string | null =>
		primaryMarketTag($marketTags[marketId]) ?? null;

	const openPositions = $derived(
		$positions.filter((pos) => getMarketById(pos.marketId)?.status !== 'Resolved')
	);

	const resolvedPositions = $derived(
		$positions.filter((pos) => getMarketById(pos.marketId)?.status === 'Resolved')
	);

	// ── Hero VXP balance + weekly delta (Wallet pattern) ─────────────

	const vxpBalance = $derived.by((): bigint => $balancesStore?.[VXP_TOKEN.id] ?? ZERO);

	const vxpBalanceDisplay = $derived(
		formatVxpBalance({ value: vxpBalance, decimals: VXP_TOKEN.decimals })
	);

	// Weekly VXP delta — sums realized PnL across resolved positions whose
	// settlement event landed in the last 7 days. The clearing `Event`
	// type doesn't carry the user's entry, so we approximate by walking
	// `Settled` events in the window, joining each to the matching
	// position by `series_id`, and accumulating the cached PnL via
	// {@link calculatePositionPnL}. Only VXP-denominated markets
	// contribute to the VXP hero delta.
	const weeklyVxpDelta = $derived.by((): number => {
		const cutoffNs = BigInt(Date.now() - 7 * 24 * 60 * 60 * 1000) * 1_000_000n;

		const recentSettlements = $tradeHistory.filter(
			(event) => event.timestamp >= cutoffNs && 'Settled' in event.event_type
		);

		return recentSettlements.reduce<number>((acc, event) => {
			const market = getMarketById(event.series_id);

			if (market === undefined || market.token.symbol !== VXP_TOKEN.symbol) {
				return acc;
			}

			const position = $positions.find((p) => p.marketId === event.series_id);

			if (position === undefined) {
				return acc;
			}

			return acc + calculatePositionPnL({ position, market });
		}, 0);
	});

	const weeklyDeltaDirection = $derived.by((): 'positive' | 'negative' | 'flat' => {
		if (weeklyVxpDelta > 0) {
			return 'positive';
		}

		if (weeklyVxpDelta < 0) {
			return 'negative';
		}

		return 'flat';
	});

	const weeklyDeltaDisplay = $derived.by((): string => {
		if (weeklyDeltaDirection === 'flat') {
			return '';
		}

		const positive = weeklyDeltaDirection === 'positive';
		const sign = positive ? '+' : '−';
		const abs = positive ? weeklyVxpDelta : -weeklyVxpDelta;

		return `${sign}${abs.toFixed(0)} VXP`;
	});

	// ── 3-col mini stats ─────────────────────────────────────────────

	const lifetimeVxpDisplay = $derived(vxpBalanceDisplay);

	// ── Helpers for the open / resolved row PnL renderers ────────────

	const positionPnl = (pos: Position): number =>
		calculatePositionPnL({ position: pos, market: getMarketById(pos.marketId) });

	const formatRowPnl = (pos: Position): string =>
		formatPositionPnLWithOptionalUnit({
			pnl: positionPnl(pos),
			playground: $playgroundVxpUnitMode
		});

	const formatProb = (p: number): string => `${(p * 100).toFixed(0)}%`;

	const sideLabel = (pos: Position): string => {
		const market = getMarketById(pos.marketId);

		return market?.outcomes?.find((o) => o.id === pos.outcomeId)?.title ?? pos.outcomeId;
	};
</script>

{#snippet portfolioAppbarRight()}
	<span class="appbar-icon-btn portfolio-appbar-icon" aria-hidden="true">
		<LineChart size={18} strokeWidth={1.8} />
	</span>
{/snippet}

<div class="portfolio-page">
	<MobileAppBar
		align="left"
		right={portfolioAppbarRight}
		title={t({ locale: $localeStore, key: 'portfolio.title' })}
	/>

	<!-- Hero: VXP eyebrow + 48px num + weekly delta + 3-col mini stats. -->
	<section class="portfolio-hero">
		<p class="eyebrow portfolio-hero-eyebrow">
			{t({ locale: $localeStore, key: 'portfolio.hero.eyebrow' })}
		</p>
		<p class="num portfolio-hero-num">{vxpBalanceDisplay}</p>

		{#if weeklyDeltaDirection === 'flat'}
			<p class="num portfolio-hero-delta is-flat">
				{t({ locale: $localeStore, key: 'portfolio.hero.no_activity_week' })}
			</p>
		{:else}
			<p
				class="num portfolio-hero-delta"
				class:is-negative={weeklyDeltaDirection === 'negative'}
				class:is-positive={weeklyDeltaDirection === 'positive'}
			>
				{t({
					locale: $localeStore,
					key: 'portfolio.hero.delta_this_week',
					params: { amount: weeklyDeltaDisplay }
				})}
			</p>
		{/if}

		<dl class="portfolio-hero-stats">
			<div class="portfolio-hero-stat">
				<dt class="eyebrow">{t({ locale: $localeStore, key: 'portfolio.stat.active' })}</dt>
				<dd class="num">{openPositions.length}</dd>
			</div>
			<div class="portfolio-hero-stat">
				<dt class="eyebrow">{t({ locale: $localeStore, key: 'portfolio.stat.resolved' })}</dt>
				<dd class="num">{resolvedPositions.length}</dd>
			</div>
			<div class="portfolio-hero-stat">
				<dt class="eyebrow">{t({ locale: $localeStore, key: 'portfolio.stat.lifetime_vxp' })}</dt>
				<dd class="num">{lifetimeVxpDisplay}</dd>
			</div>
		</dl>
	</section>

	{#if refreshing && openPositions.length === 0 && resolvedPositions.length === 0 && $orders.length === 0}
		<!-- Inline loading skeleton — the hero renders synchronously above
			 and `<Loaders />` polls in the background. -->
		<section class="portfolio-section">
			<div class="portfolio-skeleton"></div>
			<div class="portfolio-skeleton"></div>
			<div class="portfolio-skeleton"></div>
		</section>
	{:else if openPositions.length === 0 && resolvedPositions.length === 0 && $orders.length === 0}
		<!-- Empty state — quote · body · Open Flow CTA. -->
		<section class="portfolio-empty">
			<p class="portfolio-empty-quote serif-italic">
				{t({ locale: $localeStore, key: 'portfolio.empty.quote' })}
			</p>
			<p class="portfolio-empty-body">
				{t({ locale: $localeStore, key: 'portfolio.empty.body' })}
			</p>
			<button
				class="portfolio-empty-cta"
				onclick={() => void goto(resolve(AppPath.Flow))}
				type="button"
			>
				{t({ locale: $localeStore, key: 'portfolio.empty.cta' })}
			</button>
		</section>
	{:else}
		<!-- Active calls — flat list. -->
		{#if openPositions.length > 0}
			<section class="portfolio-section">
				<header class="portfolio-section-head">
					<h2 class="portfolio-section-title">
						{t({ locale: $localeStore, key: 'portfolio.section.active' })}
					</h2>
					<span class="num portfolio-section-count">{openPositions.length}</span>
				</header>

				<ul class="portfolio-list">
					{#each openPositions as pos (`${pos.marketId}::${pos.outcomeId}`)}
						{@const market = getMarketById(pos.marketId)}
						{@const pnl = positionPnl(pos)}
						{@const categoryId = getCategoryId(pos.marketId)}
						{@const sideKey =
							pos.outcomeId === 'YES' ? 'yes' : pos.outcomeId === 'NO' ? 'no' : 'hold'}
						{@const yesProb = market?.yesProbability ?? 0}
						{@const sideProb = pos.outcomeId === 'YES' ? yesProb : 1 - yesProb}

						<li>
							<a
								class="portfolio-row"
								aria-label={market?.title ??
									t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
								href="{AppPath.Markets}/{pos.marketId}"
							>
								<PositionArtThumb {categoryId} marketId={pos.marketId} result="neutral" size={40} />
								<div class="portfolio-row-body">
									<div class="portfolio-row-head">
										<span class="portfolio-row-title">
											{market?.title ??
												t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
										</span>
										<span class="portfolio-row-side portfolio-row-side-{sideKey}">
											{sideLabel(pos)}
										</span>
									</div>
									<div class="portfolio-row-meta">
										<span class="num portfolio-row-prob">
											{t({
												locale: $localeStore,
												key: 'portfolio.row.payout_at',
												params: { prob: formatProb(sideProb) }
											})}
										</span>
										<span
											class="num portfolio-row-pnl"
											class:is-negative={pnl < 0}
											class:is-positive={pnl >= 0}
										>
											{formatRowPnl(pos)}
										</span>
									</div>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Resolved — flat list with W/L glyph. -->
		{#if resolvedPositions.length > 0}
			<section class="portfolio-section">
				<header class="portfolio-section-head">
					<h2 class="portfolio-section-title">
						{t({ locale: $localeStore, key: 'portfolio.section.resolved' })}
					</h2>
					<span class="num portfolio-section-count">{resolvedPositions.length}</span>
				</header>

				<ul class="portfolio-list">
					{#each resolvedPositions as pos (`${pos.marketId}::${pos.outcomeId}`)}
						{@const market = getMarketById(pos.marketId)}
						{@const result = market
							? (positionResolvedResult({ market, position: pos }) ?? 'neutral')
							: 'neutral'}
						{@const pnl = positionPnl(pos)}

						<li>
							<a class="portfolio-row" href="{AppPath.Markets}/{pos.marketId}">
								<span
									class="portfolio-row-glyph"
									class:is-lost={result === 'lost'}
									class:is-won={result === 'won'}
									aria-hidden="true"
								>
									{result === 'won' ? 'W' : result === 'lost' ? 'L' : '—'}
								</span>
								<div class="portfolio-row-body">
									<div class="portfolio-row-head">
										<span class="portfolio-row-title">
											{market?.title ??
												t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
										</span>
									</div>
									<div class="portfolio-row-meta">
										<span
											class="num portfolio-row-pnl"
											class:is-negative={pnl < 0}
											class:is-positive={pnl >= 0}
										>
											{formatRowPnl(pos)}
										</span>
									</div>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- C-25 (production keep) — Open orders table for limit orders. -->
		{#if $orders.length > 0}
			<section class="portfolio-section portfolio-orders">
				<OpenOrdersTable markets={$markets} onRefresh={onOrdersRefresh} orders={$orders} />
			</section>
		{/if}
	{/if}
</div>

<style lang="postcss">
	.portfolio-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 0 1.25rem 6rem;
	}

	/* ── Appbar icon ─────────────────────────────────────────────── */
	/* Decorative icon (not interactive) — disable the hover affordance
	   inherited from `.appbar-icon-btn` and unset cursor. */
	.portfolio-appbar-icon {
		cursor: default;
	}

	.portfolio-appbar-icon:hover {
		border-color: var(--border-base);
		background: var(--bg-surface);
	}

	/* ── Hero card ───────────────────────────────────────────────── */
	.portfolio-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.5rem 1.25rem 1.5rem;
		text-align: center;
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-16, 16px);
	}

	.portfolio-hero-eyebrow {
		margin: 0;
		color: var(--text-muted);
	}

	.portfolio-hero-num {
		margin: 0.25rem 0 0;
		font-size: 48px;
		font-weight: 600;
		letter-spacing: -0.04em;
		color: var(--text-base);
		line-height: 1;
	}

	.portfolio-hero-delta {
		margin: 0.25rem 0 0;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-muted);
	}

	.portfolio-hero-delta.is-positive {
		color: var(--yes);
	}

	.portfolio-hero-delta.is-negative {
		color: var(--no);
	}

	.portfolio-hero-delta.is-flat {
		color: var(--text-muted);
	}

	.portfolio-hero-stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
		width: 100%;
		margin: 1rem 0 0;
	}

	.portfolio-hero-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.625rem 0.5rem;
		background: var(--bg-popover);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.portfolio-hero-stat dt {
		margin: 0;
		color: var(--text-muted);
	}

	.portfolio-hero-stat dd {
		margin: 0;
		font-size: var(--t-14);
		font-weight: 600;
		color: var(--text-base);
		letter-spacing: -0.01em;
	}

	/* ── Section header (replaces SectionHeader / counts row) ────── */
	.portfolio-section {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.portfolio-section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.portfolio-section-title {
		margin: 0;
		font-size: var(--t-16, 1rem);
		font-weight: 700;
		color: var(--text-base);
	}

	.portfolio-section-count {
		font-size: var(--t-13);
		color: var(--text-muted);
	}

	/* ── List rows ───────────────────────────────────────────────── */
	.portfolio-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.portfolio-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0.875rem;
		text-decoration: none;
		color: inherit;
		background: var(--bg-popover);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		transition: border-color var(--d-hover) var(--ease-vici);
	}

	.portfolio-row:hover {
		border-color: var(--border-strong);
	}

	.portfolio-row-body {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		flex: 1;
	}

	.portfolio-row-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.portfolio-row-title {
		flex: 1;
		font-size: var(--t-13);
		font-weight: 600;
		line-height: 1.35;
		color: var(--text-base);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
	}

	.portfolio-row-side {
		flex: 0 0 auto;
		padding: 0.125rem 0.4rem;
		font-family: var(--font-mono);
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border-radius: 4px;
		border: 1px solid var(--border-base);
	}

	.portfolio-row-side-yes {
		color: var(--yes);
		border-color: var(--yes);
		background: var(--yes-wash);
	}

	.portfolio-row-side-no {
		color: var(--no);
		border-color: var(--no);
		background: var(--no-wash);
	}

	.portfolio-row-side-hold {
		color: var(--text-muted);
	}

	.portfolio-row-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.portfolio-row-prob {
		font-size: var(--text-eyebrow, 11px);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.portfolio-row-pnl {
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--text-muted);
	}

	.portfolio-row-pnl.is-positive {
		color: var(--yes);
	}

	.portfolio-row-pnl.is-negative {
		color: var(--no);
	}

	/* ── Resolved row glyph (W / L / —) ──────────────────────────── */
	.portfolio-row-glyph {
		display: inline-flex;
		width: 2.5rem;
		height: 2.5rem;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--text-muted);
		background: var(--bg-surface);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
	}

	.portfolio-row-glyph.is-won {
		color: var(--yes);
		border-color: var(--yes);
		background: var(--yes-wash);
	}

	.portfolio-row-glyph.is-lost {
		color: var(--no);
		border-color: var(--no);
		background: var(--no-wash);
	}

	/* ── Empty state ─────────────────────────────────────────────── */
	.portfolio-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.875rem;
		padding: 2rem 1rem;
		text-align: center;
	}

	.portfolio-empty-quote {
		margin: 0;
		max-width: 28ch;
		font-size: var(--t-16, 1rem);
		color: var(--text-base);
	}

	.portfolio-empty-body {
		margin: 0;
		max-width: 32ch;
		font-size: var(--t-13);
		color: var(--text-muted);
		line-height: 1.5;
	}

	.portfolio-empty-cta {
		margin-top: 0.5rem;
		appearance: none;
		padding: 0.75rem 1.25rem;
		font: inherit;
		font-size: var(--t-13);
		font-weight: 600;
		color: var(--bg-base);
		background: var(--text-base);
		border: 1px solid var(--text-base);
		border-radius: var(--r-12);
		cursor: pointer;
		transition: opacity var(--d-hover) var(--ease-vici);
	}

	.portfolio-empty-cta:hover {
		opacity: 0.9;
	}

	/* ── Loading skeleton ────────────────────────────────────────── */
	.portfolio-skeleton {
		height: 4rem;
		background: var(--bg-popover);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		opacity: 0.6;
	}

	/* ── Orders section spacing override (C-25 retain) ───────────── */
	:global(.portfolio-orders) {
		margin-top: 0.25rem;
	}
</style>
