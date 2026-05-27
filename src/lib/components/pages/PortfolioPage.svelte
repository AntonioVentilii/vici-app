<script lang="ts">
	import { LineChart } from 'lucide-svelte/icons';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import OpenOrdersTable from '$lib/components/portfolio/OpenOrdersTable.svelte';
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
	import { userStore } from '$lib/stores/user.store';
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
	 *   right slot (matches the prototype's appbar).
	 * - Hero card (centered, gradient surface) — `TOTAL HOLDINGS` eyebrow,
	 *   38px VXP balance + "VXP" suffix, weekly delta line in laurel /
	 *   no-red. Mirrors the prototype's `card-elevated` styling.
	 * - 3-col mini-stats: Unrealized P&L · 7D Accuracy · Active (the
	 *   prototype's third tile is RANK; our backend has no rank field,
	 *   so we substitute open-position count). Replaces the legacy
	 *   `PortfolioStats` 6-tile holdings card.
	 * - Open positions — flat list, each row: category tag (top-left) ·
	 *   side tag (top-right) · 2-line market title · "Payout at X%" ·
	 *   signed PnL. Tap routes to the market detail.
	 * - Resolved positions — flat list, each row: W/L glyph · market
	 *   title · signed PnL.
	 * - C-25 (production keep) — `OpenOrdersTable` retained for limit
	 *   orders.
	 *
	 * Deferred from the prototype: PerfChart (30-day sparkline) and
	 * Allocation (5-bucket category bars) — both would require new
	 * derived stores beyond the constraint zone for this pass.
	 */

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

	const openPositions = $derived(
		$positions.filter((pos) => getMarketById(pos.marketId)?.status !== 'Resolved')
	);

	const resolvedPositions = $derived(
		$positions.filter((pos) => getMarketById(pos.marketId)?.status === 'Resolved')
	);

	// ── Hero VXP balance + weekly delta ──────────────────────────────

	const vxpBalance = $derived.by((): bigint => $balancesStore?.[VXP_TOKEN.id] ?? ZERO);

	const vxpBalanceDisplay = $derived(
		formatVxpBalance({ value: vxpBalance, decimals: VXP_TOKEN.decimals })
	);

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

	// ── 3-col mini stats (Unrealized P&L · 7D Accuracy · Active) ─────

	const unrealizedPnl = $derived.by((): number =>
		openPositions.reduce<number>((acc, pos) => {
			const market = getMarketById(pos.marketId);

			if (market === undefined || market.token.symbol !== VXP_TOKEN.symbol) {
				return acc;
			}

			return acc + calculatePositionPnL({ position: pos, market });
		}, 0)
	);

	const unrealizedPnlDirection = $derived.by((): 'positive' | 'negative' | 'flat' => {
		if (unrealizedPnl > 0) {
			return 'positive';
		}

		if (unrealizedPnl < 0) {
			return 'negative';
		}

		return 'flat';
	});

	const unrealizedPnlDisplay = $derived.by((): string => {
		if (unrealizedPnl === 0) {
			return '0 VXP';
		}

		const positive = unrealizedPnl > 0;
		const sign = positive ? '+' : '−';
		const abs = positive ? unrealizedPnl : -unrealizedPnl;

		return `${sign}${abs.toFixed(0)} VXP`;
	});

	const accuracyValue = $derived($userStore.profile?.accuracy ?? 0);

	const accuracyDisplay = $derived(`${(accuracyValue * 100).toFixed(1)}%`);

	// ── Helpers ──────────────────────────────────────────────────────

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

	const categoryLabel = (marketId: string): string | null => {
		const tag = primaryMarketTag($marketTags[marketId]);

		return tag ? tag.toUpperCase() : null;
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

	<section class="portfolio-hero">
		<p class="eyebrow portfolio-hero-eyebrow">
			{t({ locale: $localeStore, key: 'portfolio.hero.eyebrow' })}
		</p>
		<div class="portfolio-hero-balance">
			<span class="num portfolio-hero-num">{vxpBalanceDisplay}</span>
			<span class="eyebrow portfolio-hero-num-unit">
				{t({ locale: $localeStore, key: 'portfolio.hero.unit' })}
			</span>
		</div>

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
				<dt class="eyebrow">
					{t({ locale: $localeStore, key: 'portfolio.stat.unrealized_pnl' })}
				</dt>
				<dd
					class="num"
					class:is-negative={unrealizedPnlDirection === 'negative'}
					class:is-positive={unrealizedPnlDirection === 'positive'}
				>
					{unrealizedPnlDisplay}
				</dd>
			</div>
			<div class="portfolio-hero-stat">
				<dt class="eyebrow">
					{t({ locale: $localeStore, key: 'portfolio.stat.accuracy_7d' })}
				</dt>
				<dd class="num">{accuracyDisplay}</dd>
			</div>
			<div class="portfolio-hero-stat">
				<dt class="eyebrow">{t({ locale: $localeStore, key: 'portfolio.stat.active' })}</dt>
				<dd class="num">{openPositions.length}</dd>
			</div>
		</dl>
	</section>

	{#if refreshing && openPositions.length === 0 && resolvedPositions.length === 0 && $orders.length === 0}
		<section class="portfolio-section">
			<div class="portfolio-skeleton"></div>
			<div class="portfolio-skeleton"></div>
			<div class="portfolio-skeleton"></div>
		</section>
	{:else if openPositions.length === 0 && resolvedPositions.length === 0 && $orders.length === 0}
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
						{@const sideKey =
							pos.outcomeId === 'YES' ? 'yes' : pos.outcomeId === 'NO' ? 'no' : 'hold'}
						{@const yesProb = market?.yesProbability ?? 0}
						{@const sideProb = pos.outcomeId === 'YES' ? yesProb : 1 - yesProb}
						{@const catLabel = categoryLabel(pos.marketId)}

						<li>
							<a
								class="portfolio-row portfolio-row-card"
								aria-label={market?.title ??
									t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
								href="{AppPath.Markets}/{pos.marketId}"
							>
								<div class="portfolio-row-tags">
									{#if catLabel}
										<span class="portfolio-row-cat">{catLabel}</span>
									{:else}
										<span class="portfolio-row-cat is-dim">—</span>
									{/if}
									<span class="portfolio-row-side portfolio-row-side-{sideKey}">
										{sideLabel(pos)}
									</span>
								</div>
								<div class="portfolio-row-title">
									{market?.title ?? t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
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
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

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
										<span class="portfolio-row-title-inline">
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

	.portfolio-appbar-icon {
		cursor: default;
	}

	.portfolio-appbar-icon:hover {
		border-color: var(--border-base);
		background: var(--bg-surface);
	}

	.portfolio-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		padding: 1.25rem;
		text-align: center;
		background: linear-gradient(
			180deg,
			var(--bg-elevated, var(--bg-surface)),
			var(--bg-raised, var(--bg-popover))
		);
		border: 1px solid var(--border-base);
		border-radius: var(--r-16, 16px);
	}

	.portfolio-hero-eyebrow {
		margin: 0;
		color: var(--text-muted);
	}

	.portfolio-hero-balance {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.portfolio-hero-num {
		font-size: 38px;
		font-weight: 600;
		letter-spacing: -0.03em;
		color: var(--text-base);
		line-height: 1;
	}

	.portfolio-hero-num-unit {
		color: var(--text-muted);
	}

	.portfolio-hero-delta {
		margin: 0.125rem 0 0;
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
		margin: 0.875rem 0 0;
	}

	.portfolio-hero-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 0.375rem;
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

	.portfolio-hero-stat dd.is-positive {
		color: var(--yes);
	}

	.portfolio-hero-stat dd.is-negative {
		color: var(--no);
	}

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

	.portfolio-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
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

	.portfolio-row-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.875rem;
	}

	.portfolio-row-tags {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.portfolio-row-cat {
		font-family: var(--font-mono);
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.portfolio-row-cat.is-dim {
		opacity: 0.5;
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
		font-size: var(--t-13);
		font-weight: 600;
		line-height: 1.4;
		color: var(--text-base);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
	}

	.portfolio-row-title-inline {
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

	.portfolio-skeleton {
		height: 4rem;
		background: var(--bg-popover);
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		opacity: 0.6;
	}

	:global(.portfolio-orders) {
		margin-top: 0.25rem;
	}
</style>
