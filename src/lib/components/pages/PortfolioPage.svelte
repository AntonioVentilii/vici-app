<script lang="ts">
	import { LineChart } from 'lucide-svelte/icons';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import OpenOrdersTable from '$lib/components/portfolio/OpenOrdersTable.svelte';
	import PortfolioAllocationCard from '$lib/components/portfolio/PortfolioAllocationCard.svelte';
	import PortfolioEmptyState from '$lib/components/portfolio/PortfolioEmptyState.svelte';
	import PortfolioHero from '$lib/components/portfolio/PortfolioHero.svelte';
	import PortfolioPerformanceCard from '$lib/components/portfolio/PortfolioPerformanceCard.svelte';
	import {
		EM_DASH,
		MILLISECOND_IN_NANOSECONDS,
		USD_DECIMALS,
		ZERO
	} from '$lib/constants/app.constants';
	import { primaryMarketTag } from '$lib/constants/market-tags.constants';
	import { AppPath } from '$lib/constants/routes.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { marketTags } from '$lib/derived/market-tags.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { orders, ordersNotInitialized } from '$lib/derived/orders.derived';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { positions, positionsNotInitialized } from '$lib/derived/positions.derived';
	import {
		resolvedPositions,
		resolvedPositionsNotInitialized
	} from '$lib/derived/resolved-positions.derived';
	import { tradeHistoryNotInitialized } from '$lib/derived/trade-history.derived';
	import { balancesStore } from '$lib/stores/balances.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Position, ResolvedPosition } from '$lib/types/position';
	import { decimalFixedValueToNumber } from '$lib/utils/format.utils';
	import { t } from '$lib/utils/i18n.utils';
	import {
		formatPositionPnLWithOptionalUnit,
		formatVxpBalance
	} from '$lib/utils/playground-display.utils';
	import { calculatePositionPnL, positionEntryProbability } from '$lib/utils/portfolio.utils';
	import { refreshOrders, refreshPositions } from '$lib/utils/refresh.utils';
	import { inferResolvedOutcomeId } from '$lib/utils/resolved-position.utils';
	import { tagColor } from '$lib/utils/tag-color.utils';

	/**
	 * Portfolio page — single-page hero + flat lists.
	 *
	 * Layout (top → bottom)
	 * - `MobileAppBar`, title "Portfolio", chart icon right.
	 * - Hero card (left-aligned, gradient surface) — TOTAL HOLDINGS
	 *   eyebrow, 38 px VXP balance + unit, 3-col stat row
	 *   (Unrealized P&L · 7D Accuracy · Rank).
	 * - Performance · 30D card with signed % delta and sparkline of
	 *   cumulative realised PnL over 30 days. Hidden when the user has
	 *   no settled VXP events in window.
	 * - Allocation card — per-tag share of open VXP capital, top 5 +
	 *   Other, sorted by descending share. Hidden when no open VXP
	 *   positions.
	 * - Active calls — flat list with per-category accent tag + side
	 *   tag, market title, "Entry X% → Y%" entry-to-current probability,
	 *   and signed "+N VXP · +M%" PnL (delta also expressed as
	 *   price-move %).
	 * - Recent history — flat resolved rows: title, side tag, "Xd ago",
	 *   WIN/LOSS label, signed +VXP.
	 * - Open orders — same card shape as active calls, with the order's
	 *   limit price + qty in place of the entry → current strip, plus
	 *   an inline cancel button.
	 *
	 * Rank: not yet served by the satellite — rendered as `EM_DASH`
	 * placeholder, mirroring the Dash page treatment.
	 */

	const refreshing = $derived(
		$positionsNotInitialized ||
			$tradeHistoryNotInitialized ||
			$marketsNotInitialized ||
			$ordersNotInitialized ||
			$resolvedPositionsNotInitialized
	);

	const onOrdersRefresh = () => {
		refreshOrders();
		refreshPositions();
	};

	const getMarketById = (id: string) => $markets.find((m) => m.id === id);

	// Live positions whose market hasn't resolved yet. The clearing canister
	// deletes positions on settlement, so anything still in `$positions` is
	// by definition unresolved — but keep the explicit filter so a brief
	// staleness window (positions seen before the market list catches up)
	// can't show a settled row in the Active section.
	const openPositions = $derived(
		$positions.filter((pos) => getMarketById(pos.marketId)?.status !== 'Resolved')
	);

	// ── Hero VXP balance ─────────────────────────────────────────────

	// Free balance in the user's VXP ICRC ledger account. Drops toward
	// zero as VXP is moved into the clearing canister as collateral, so
	// the "Total Holdings" hero must combine this with the locked
	// portion below — otherwise a user with all VXP in open positions
	// shows "0 VXP" despite owning plenty.
	const vxpBalance = $derived.by((): bigint => $balancesStore?.[VXP_TOKEN.id] ?? ZERO);

	// Locked-as-collateral portion across active positions on VXP
	// markets. Same shape + scale as the matching sum on Dash.
	const backedRaw = $derived.by((): bigint =>
		$positions.reduce<bigint>((acc, pos) => {
			const market = $markets.find((m) => m.id === pos.marketId);

			if (market === undefined || market.token.symbol !== VXP_TOKEN.symbol) {
				return acc;
			}

			return acc + pos.lockedCollateral;
		}, ZERO)
	);

	// Total = free + backed. Both legs share a 4-decimal scale
	// (`VXP_TOKEN.decimals` == `USD_DECIMALS`), so we add raw bigints
	// before formatting.
	const holdingsTotalRaw = $derived(vxpBalance + backedRaw);

	const vxpBalanceDisplay = $derived(
		formatVxpBalance({ value: holdingsTotalRaw, decimals: VXP_TOKEN.decimals })
	);

	// Performance card uses the *total* holdings as its denominator so
	// the % delta tracks the same number the hero shows.
	const vxpBalanceNumber = $derived(
		decimalFixedValueToNumber({ value: holdingsTotalRaw, decimals: VXP_TOKEN.decimals })
	);

	// ── 3-col mini stats (Unrealized P&L · 7D Accuracy · Rank) ───────

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
			return `0 ${VXP_TOKEN.symbol}`;
		}

		const positive = unrealizedPnl > 0;
		const sign = positive ? '+' : '−';
		const abs = positive ? unrealizedPnl : -unrealizedPnl;

		return `${sign}${abs.toFixed(0)} ${VXP_TOKEN.symbol}`;
	});

	// `profile.accuracy` is persisted as a 0..100 percentage (see
	// `profile.services.ts` `calculateAndSyncStats`). Render directly —
	// multiplying by 100 here gave 10000% for a fully-accurate user.
	const accuracyValue = $derived($userStore.profile?.accuracy ?? 0);

	const accuracyDisplay = $derived(`${accuracyValue.toFixed(1)}%`);

	// ── Active-call row helpers ──────────────────────────────────────

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

	/**
	 * Per-category accent for the row tag chip. Falls back to the
	 * laurel-gold default when the market has no recognised tag — same
	 * fallback `tagColor()` uses internally.
	 */
	const categoryAccent = (marketId: string): string => {
		const tag = primaryMarketTag($marketTags[marketId]);

		return tagColor(tag ?? '');
	};

	const positionSideProb = (pos: Position): number => {
		const market = getMarketById(pos.marketId);
		const yesProb = market?.yesProbability ?? 0;

		return pos.outcomeId === 'YES' ? yesProb : 1 - yesProb;
	};

	const positionEntryProb = (pos: Position): number | undefined =>
		positionEntryProbability({ position: pos, market: getMarketById(pos.marketId) });

	const positionMoveDisplay = (pos: Position): string | undefined => {
		const entry = positionEntryProb(pos);

		if (entry === undefined) {
			return;
		}

		const current = positionSideProb(pos);
		const pctMove = (current - entry) * 100;
		const sign = pctMove >= 0 ? '+' : '−';

		return `${sign}${Math.abs(pctMove).toFixed(1)}%`;
	};

	// ── Recent-history row helpers ───────────────────────────────────

	/**
	 * Realized PnL in VXP units (clearing-USD scale → number) for a
	 * settled-event-derived row. Matches `formatPositionPnLWithOptionalUnit`
	 * shape so the row formatter can stay symmetric with the Active list.
	 */
	const resolvedPnlNumber = (resolved: ResolvedPosition): number =>
		decimalFixedValueToNumber({ value: resolved.realizedPnlUsd, decimals: USD_DECIMALS });

	const formatResolvedRowPnl = (resolved: ResolvedPosition): string =>
		formatPositionPnLWithOptionalUnit({
			pnl: resolvedPnlNumber(resolved),
			playground: $playgroundVxpUnitMode
		});

	/**
	 * Display side label for a resolved row. Side-inference rules live in
	 * `inferResolvedOutcomeId` — see that helper for the per-payoff-type
	 * fallback behavior (binary losers map to the opposite outcome,
	 * categorical losers stay unknown).
	 */
	const resolvedSideLabel = (resolved: ResolvedPosition): string => {
		const market = getMarketById(resolved.marketId);
		const outcomeId = inferResolvedOutcomeId({ resolved, market });

		if (outcomeId === undefined) {
			return EM_DASH;
		}

		return market?.outcomes?.find((o) => o.id === outcomeId)?.title ?? outcomeId;
	};

	/**
	 * Maps the inferred outcome to the visual side-tag bucket (yes / no /
	 * hold) used by the row chip styles.
	 */
	const resolvedSideKey = (resolved: ResolvedPosition): 'yes' | 'no' | 'hold' => {
		const market = getMarketById(resolved.marketId);
		const outcomeId = inferResolvedOutcomeId({ resolved, market });

		if (outcomeId === 'YES') {
			return 'yes';
		}

		if (outcomeId === 'NO') {
			return 'no';
		}

		return 'hold';
	};

	/**
	 * Approximate "Xd ago" / "Xh ago" timestamp for the Recent-history
	 * block. Uses the Settled event's own `timestampNs` carried on the
	 * `ResolvedPosition`; no fallback needed because the record exists
	 * iff a Settled event produced it.
	 */
	const resolvedAgoDisplay = (resolved: ResolvedPosition): string => {
		const tsMs = Number(resolved.timestampNs / MILLISECOND_IN_NANOSECONDS);
		const diffMs = Date.now() - tsMs;
		const HOUR_MS = 60 * 60 * 1000;
		const DAY_MS = 24 * HOUR_MS;

		if (diffMs < HOUR_MS) {
			return t({ locale: $localeStore, key: 'portfolio.row.ago_just_now' });
		}

		const days = Math.floor(diffMs / DAY_MS);

		if (days >= 1) {
			return t({
				locale: $localeStore,
				key: 'portfolio.row.ago_days',
				params: { days: String(days) }
			});
		}

		const hours = Math.floor(diffMs / HOUR_MS);

		return t({
			locale: $localeStore,
			key: 'portfolio.row.ago_hours',
			params: { hours: String(hours) }
		});
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

	<PortfolioHero
		{accuracyDisplay}
		{unrealizedPnlDirection}
		{unrealizedPnlDisplay}
		{vxpBalanceDisplay}
	/>

	<PortfolioPerformanceCard
		markets={$markets}
		resolvedPositions={$resolvedPositions}
		vxpBalance={vxpBalanceNumber}
	/>

	<PortfolioAllocationCard marketTags={$marketTags} markets={$markets} positions={openPositions} />

	{#if refreshing && openPositions.length === 0 && $resolvedPositions.length === 0 && $orders.length === 0}
		<section class="portfolio-section">
			<div class="portfolio-skeleton"></div>
			<div class="portfolio-skeleton"></div>
			<div class="portfolio-skeleton"></div>
		</section>
	{:else if openPositions.length === 0 && $resolvedPositions.length === 0 && $orders.length === 0}
		<PortfolioEmptyState />
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
						{@const entry = positionEntryProb(pos)}
						{@const current = positionSideProb(pos)}
						{@const move = positionMoveDisplay(pos)}
						{@const catLabel = categoryLabel(pos.marketId)}
						{@const catAccent = categoryAccent(pos.marketId)}

						<li>
							<a
								class="portfolio-row portfolio-row-card"
								aria-label={market?.title ??
									t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
								href="{AppPath.Markets}/{pos.marketId}"
							>
								<div class="portfolio-row-tags">
									{#if catLabel}
										<span style:color={catAccent} class="portfolio-row-cat">{catLabel}</span>
									{:else}
										<span class="portfolio-row-cat is-dim">{EM_DASH}</span>
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
										{#if entry !== undefined}
											{t({
												locale: $localeStore,
												key: 'portfolio.row.entry_to_current',
												params: { entry: formatProb(entry), current: formatProb(current) }
											})}
										{:else}
											{t({
												locale: $localeStore,
												key: 'portfolio.row.payout_at',
												params: { prob: formatProb(current) }
											})}
										{/if}
									</span>
									<span
										class="num portfolio-row-pnl"
										class:is-negative={pnl < 0}
										class:is-positive={pnl >= 0}
									>
										{formatRowPnl(pos)}{#if move !== undefined}<span class="portfolio-row-move">
												· {move}</span
											>{/if}
									</span>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if $resolvedPositions.length > 0}
			<section class="portfolio-section">
				<header class="portfolio-section-head">
					<h2 class="portfolio-section-title">
						{t({ locale: $localeStore, key: 'portfolio.section.recent_history' })}
					</h2>
					<span class="portfolio-section-more">
						{t({ locale: $localeStore, key: 'portfolio.section.see_all' })}
					</span>
				</header>

				<ul class="portfolio-list">
					{#each $resolvedPositions as resolved (resolved.eventId)}
						{@const market = getMarketById(resolved.marketId)}
						{@const pnl = resolvedPnlNumber(resolved)}
						{@const sideKey = resolvedSideKey(resolved)}
						{@const resultKey =
							resolved.result === 'won' ? 'win' : resolved.result === 'lost' ? 'loss' : 'neutral'}

						<li>
							<a class="portfolio-history-row" href="{AppPath.Markets}/{resolved.marketId}">
								<div class="portfolio-history-body">
									<div class="portfolio-history-title">
										{market?.title ?? t({ locale: $localeStore, key: 'portfolio.unknown_market' })}
									</div>
									<div class="portfolio-history-meta">
										<span class="portfolio-row-side portfolio-row-side-{sideKey}">
											{resolvedSideLabel(resolved)}
										</span>
										<span class="num portfolio-history-ago">{resolvedAgoDisplay(resolved)}</span>
									</div>
								</div>
								<div class="portfolio-history-end">
									<span class="portfolio-history-result portfolio-history-result-{resultKey}">
										{#if resolved.result === 'won'}
											{t({ locale: $localeStore, key: 'portfolio.row.win' })}
										{:else if resolved.result === 'lost'}
											{t({ locale: $localeStore, key: 'portfolio.row.loss' })}
										{:else}
											{EM_DASH}
										{/if}
									</span>
									<span
										class="num portfolio-history-pnl"
										class:is-negative={pnl < 0}
										class:is-positive={pnl >= 0}
									>
										{formatResolvedRowPnl(resolved)}
									</span>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if $orders.length > 0}
			<section class="portfolio-section">
				<header class="portfolio-section-head">
					<h2 class="portfolio-section-title">
						{t({ locale: $localeStore, key: 'portfolio.orders.title' })}
					</h2>
					<span class="num portfolio-section-count">{$orders.length}</span>
				</header>
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

	.portfolio-section-more {
		font-size: var(--t-13);
		font-weight: 600;
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
		/* Reset the `align-items: center` inherited from `.portfolio-row`
		   (which is set for the side-by-side resolved row). On the
		   column-layout card we need children to stretch full width so
		   the inner `.portfolio-row-tags` / `.portfolio-row-meta` rows
		   can put their `justify-content: space-between` to use. */
		align-items: stretch;
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
		display: inline-flex;
		align-items: center;
		padding: 3px 7px;
		font-family: var(--font-mono);
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-base) 6%, transparent);
		border-radius: 4px;
	}

	.portfolio-row-cat.is-dim {
		opacity: 0.5;
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

	.portfolio-row-side {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		padding: 3px 7px;
		font-family: var(--font-mono);
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border-radius: 4px;
		background: color-mix(in srgb, var(--text-base) 6%, transparent);
		color: var(--text-muted);
	}

	.portfolio-row-side-yes {
		color: var(--yes);
		background: var(--yes-wash);
	}

	.portfolio-row-side-no {
		color: var(--no);
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

	.portfolio-row-move {
		font-weight: 500;
		opacity: 0.85;
	}

	.portfolio-history-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		text-decoration: none;
		color: inherit;
		background: var(--bg-raised, var(--bg-popover));
		border: 1px solid var(--border-base);
		border-radius: var(--r-12);
		transition: border-color var(--d-hover) var(--ease-vici);
	}

	.portfolio-history-row:hover {
		border-color: var(--border-strong);
	}

	.portfolio-history-body {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex: 1;
		min-width: 0;
	}

	.portfolio-history-title {
		font-size: var(--t-13);
		font-weight: 500;
		color: var(--text-base);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.portfolio-history-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.portfolio-history-ago {
		font-size: var(--text-eyebrow, 11px);
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}

	.portfolio-history-end {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.125rem;
	}

	.portfolio-history-result {
		font-family: var(--font-mono);
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.portfolio-history-result-win {
		color: var(--yes);
	}

	.portfolio-history-result-loss {
		color: var(--no);
	}

	.portfolio-history-pnl {
		font-size: var(--text-eyebrow, 11px);
		font-weight: 600;
		color: var(--text-muted);
	}

	.portfolio-history-pnl.is-positive {
		color: var(--yes);
	}

	.portfolio-history-pnl.is-negative {
		color: var(--no);
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
