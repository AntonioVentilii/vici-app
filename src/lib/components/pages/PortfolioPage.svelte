<script lang="ts">
	import { LineChart } from 'lucide-svelte/icons';
	import { onMount } from 'svelte';
	import type { ClearingDid } from '$declarations';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import OpenOrdersTable from '$lib/components/portfolio/OpenOrdersTable.svelte';
	import PortfolioStats from '$lib/components/portfolio/PortfolioStats.svelte';
	import PositionTable from '$lib/components/portfolio/PositionTable.svelte';
	import TradeHistoryTable from '$lib/components/portfolio/TradeHistoryTable.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { ZERO } from '$lib/constants/app.constants';
	import { balanceDomain } from '$lib/derived/balance-domain.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { orders, ordersNotInitialized } from '$lib/derived/orders.derived';
	import { playgroundVxpUnitMode } from '$lib/derived/playground.derived';
	import { listSeriesCategories } from '$lib/services/category.services';
	import { getPositions } from '$lib/services/position.services';
	import { getUserTradeHistory } from '$lib/services/trade.services';
	import { localeStore } from '$lib/stores/locale.store';
	import type { SeriesCategory } from '$lib/types/category';
	import type { Position } from '$lib/types/position';
	import { t } from '$lib/utils/i18n.utils';
	import {
		formatPortfolioHoldingsStatLine,
		formatPortfolioPnLStatLine
	} from '$lib/utils/playground-display.utils';
	import { calculatePositionPnL, calculatePositionValue } from '$lib/utils/portfolio.utils';

	let positions = $state<Position[]>([]);
	let tradeHistory = $state<ClearingDid.Event[]>([]);
	let categoryMappings = $state<SeriesCategory[]>([]);

	let loading = $state(true);

	let refreshing = $derived(loading || $marketsNotInitialized || $ordersNotInitialized);

	const loadData = async () => {
		loading = true;

		try {
			const [posRes, historyRes, mappingsRes] = await Promise.all([
				getPositions($balanceDomain),
				getUserTradeHistory($balanceDomain),
				// Failure here only degrades artwork (falls back to a
				// hash-pick category); never block the whole page.
				listSeriesCategories().catch(() => [] as SeriesCategory[])
			]);

			positions = posRes;
			tradeHistory = historyRes;
			categoryMappings = mappingsRes;
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		const unsubscribe = balanceDomain.subscribe(() => {
			loadData();
		});

		return unsubscribe;
	});

	const getMarketById = (id: string) => $markets.find((m) => m.id === id);

	const totalPortfolioValue = $derived(
		positions.reduce(
			(acc, pos) =>
				acc + calculatePositionValue({ position: pos, market: getMarketById(pos.marketId) }),
			ZERO
		)
	);

	const totalPnL = $derived(
		positions.reduce(
			(acc, pos) =>
				acc + calculatePositionPnL({ position: pos, market: getMarketById(pos.marketId) }),
			0
		)
	);

	const portfolioHoldingsLabel = $derived(
		formatPortfolioHoldingsStatLine({
			playground: $playgroundVxpUnitMode,
			totalPortfolioValue,
			sampleToken: positions[0] ? getMarketById(positions[0].marketId)?.token : undefined
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

<svelte:document onviciRefreshPositions={loadData} />

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
			activeMarketsCount={positions.length}
			openOrdersCount={$orders.length}
			pnlVariant={totalPnL >= 0 ? 'success' : 'warning'}
			totalHoldings={portfolioHoldingsLabel}
			totalPnL={portfolioPnLLabel}
			tradeHistoryCount={tradeHistory.length}
		/>

		<PositionTable {categoryMappings} markets={$markets} {positions} />

		<div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
			<OpenOrdersTable markets={$markets} onRefresh={loadData} orders={$orders} />

			<TradeHistoryTable events={tradeHistory} markets={$markets} />
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
