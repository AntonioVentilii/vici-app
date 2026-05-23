<script lang="ts">
	import { LineChart } from 'lucide-svelte/icons';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import OpenOrdersTable from '$lib/components/portfolio/OpenOrdersTable.svelte';
	import PortfolioStats from '$lib/components/portfolio/PortfolioStats.svelte';
	import PositionTable from '$lib/components/portfolio/PositionTable.svelte';
	import TradeHistoryTable from '$lib/components/portfolio/TradeHistoryTable.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
	import { categories } from '$lib/derived/categories.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { orders, ordersNotInitialized } from '$lib/derived/orders.derived';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { positions, positionsNotInitialized } from '$lib/derived/positions.derived';
	import { tradeHistory, tradeHistoryNotInitialized } from '$lib/derived/trade-history.derived';
	import { balancesStore } from '$lib/stores/balances.store';
	import { collateralsStore } from '$lib/stores/collaterals.store';
	import { localeStore } from '$lib/stores/locale.store';
	import { t } from '$lib/utils/i18n.utils';
	import {
		formatPortfolioHoldingsStatLine,
		formatPortfolioPnLStatLine
	} from '$lib/utils/playground-display.utils';
	import { calculatePositionPnL, calculatePositionValue } from '$lib/utils/portfolio.utils';
	import { refreshOrders, refreshPositions } from '$lib/utils/refresh.utils';

	// Cold-load spinner only on the very first visit (when no domain has
	// finished loading yet). On subsequent visits the cached positions /
	// trade history / markets / orders are rendered immediately while
	// `<Loaders />` polls a refresh in the background.
	const refreshing = $derived(
		$positionsNotInitialized ||
			$tradeHistoryNotInitialized ||
			$marketsNotInitialized ||
			$ordersNotInitialized
	);

	// `OpenOrdersTable` cancels an order then asks us to refresh. The
	// loader for orders listens to `viciRefreshOrders` (and emits a
	// position refresh because cancels free up collateral); we just fan
	// out via the shared `refresh.utils` events so we don't duplicate
	// fetch logic in the page.
	const onOrdersRefresh = () => {
		refreshOrders();
		refreshPositions();
	};

	const getMarketById = (id: string) => $markets.find((m) => m.id === id);

	// Open positions are everything that hasn't yet been settled into the
	// wallet. Resolved markets credit/debit the ICRC ledger at resolution, so
	// including them here would double-count against the wallet baseline below.
	const openPositions = $derived(
		$positions.filter((pos) => getMarketById(pos.marketId)?.status !== 'Resolved')
	);

	const openPositionsValue = $derived(
		openPositions.reduce(
			(acc, pos) =>
				acc + calculatePositionValue({ position: pos, market: getMarketById(pos.marketId) }),
			ZERO
		)
	);

	const totalPnL = $derived(
		openPositions.reduce(
			(acc, pos) =>
				acc + calculatePositionPnL({ position: pos, market: getMarketById(pos.marketId) }),
			0
		)
	);

	// Net account value: free wallet VXP + collateral locked on clearing +
	// mark-to-market value of open positions. Realized PnL is already in the
	// wallet (settlements credit/debit the ledger), so it is not added as a
	// separate term. Only applied in the VXP/playground domain — the
	// settlement domain can mix tokens with different decimals/symbols, so
	// the cash baseline is left out there to avoid summing apples and oranges.
	const totalPortfolioValue = $derived.by(() => {
		if (!$playgroundVxpUnitMode) {
			return openPositionsValue;
		}

		const walletVxp = $balancesStore?.[VXP_TOKEN.id] ?? ZERO;
		const collateralVxp = $collateralsStore?.balances[VXP_TOKEN.id] ?? ZERO;

		return walletVxp + collateralVxp + openPositionsValue;
	});

	const portfolioHoldingsLabel = $derived(
		formatPortfolioHoldingsStatLine({
			playground: $playgroundVxpUnitMode,
			totalPortfolioValue,
			sampleToken: openPositions[0] ? getMarketById(openPositions[0].marketId)?.token : undefined
		})
	);

	const portfolioPnLLabel = $derived(
		formatPortfolioPnLStatLine({ totalPnL, playground: $playgroundVxpUnitMode })
	);
</script>

{#snippet portfolioAppbarRight()}
	<span class="portfolio-mobile-icon" aria-hidden="true">
		<LineChart size={18} strokeWidth={1.8} />
	</span>
{/snippet}

{#snippet portfolioDesktopRight()}
	<span class="portfolio-desktop-icon" aria-hidden="true">
		<LineChart size={22} strokeWidth={1.6} />
	</span>
{/snippet}

<div class="space-y-7 pb-24">
	<MobileAppBar
		align="left"
		right={portfolioAppbarRight}
		title={t({ locale: $localeStore, key: 'portfolio.title' })}
	/>

	<div class="hidden md:block">
		<SectionHeader
			description={t({ locale: $localeStore, key: 'portfolio.sub' })}
			right={portfolioDesktopRight}
			title={t({ locale: $localeStore, key: 'portfolio.title' })}
		/>
	</div>

	{#if refreshing}
		<LoadingSpinner />
	{:else}
		<PortfolioStats
			activeMarketsCount={$positions.length}
			openOrdersCount={$orders.length}
			pnlVariant={totalPnL >= 0 ? 'success' : 'warning'}
			totalHoldings={portfolioHoldingsLabel}
			totalPnL={portfolioPnLLabel}
			tradeHistoryCount={$tradeHistory.length}
		/>

		<PositionTable categoryMappings={$categories} markets={$markets} positions={$positions} />

		<div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
			<OpenOrdersTable markets={$markets} onRefresh={onOrdersRefresh} orders={$orders} />

			<TradeHistoryTable events={$tradeHistory} markets={$markets} />
		</div>
	{/if}
</div>

<style lang="postcss">
	.portfolio-mobile-icon {
		display: inline-flex;
		width: 2.25rem;
		height: 2.25rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--color-primary);
	}

	.portfolio-desktop-icon {
		display: inline-flex;
		width: 2.75rem;
		height: 2.75rem;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--color-primary);
	}
</style>
