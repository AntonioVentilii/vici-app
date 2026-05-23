<script lang="ts">
	import ForkMarketModal from '$lib/components/challenge/ForkMarketModal.svelte';
	import MobileAppBar from '$lib/components/layout/MobileAppBar.svelte';
	import MarketFeed from '$lib/components/market/MarketFeed.svelte';
	import MarketFilters from '$lib/components/market/MarketFilters.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { categories } from '$lib/derived/categories.derived';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import type { Market } from '$lib/types/market';
	import {
		DEFAULT_SECONDARY_FILTERS,
		type MarketSecondaryFilters
	} from '$lib/types/market-filters';
	import { t } from '$lib/utils/i18n.utils';
	import { filterAndRankMarkets } from '$lib/utils/market-filters.utils';

	let loading = $derived($marketsNotInitialized);

	let searchTerm = $state('');
	let activeTab = $state('Active');
	let filters = $state<MarketSecondaryFilters>({ ...DEFAULT_SECONDARY_FILTERS });

	let forkModalOpen = $state(false);
	let forkTarget = $state<Market | null>(null);

	const handleChallenge = (market: Market) => {
		forkTarget = market;
		forkModalOpen = true;
	};

	const tabs = ['Active', 'Trending', 'Expiring', 'Resolved'] as const;

	const tabLabel = (tab: (typeof tabs)[number]) => {
		const key =
			tab === 'Active'
				? 'markets.tab.active'
				: tab === 'Trending'
					? 'markets.tab.trending'
					: tab === 'Expiring'
						? 'markets.tab.expiring'
						: 'markets.tab.resolved';

		return t({ locale: $localeStore, key });
	};

	const filteredMarkets = $derived(
		filterAndRankMarkets({
			markets: $markets,
			searchTerm,
			activeTab,
			filters,
			userInterests: $userStore.profile?.interests ?? [],
			categoryMappings: $categories
		})
	);
</script>

{#snippet marketsTitle()}
	<h1 class="markets-mobile-title">{t({ locale: $localeStore, key: 'nav.markets' })}</h1>
	<span class="markets-mobile-live">{t({ locale: $localeStore, key: 'hero.live' })}</span>
{/snippet}

{#snippet marketsCount()}
	<strong class="markets-mobile-count num">{filteredMarkets.length}</strong>
{/snippet}

<section class="space-y-6">
	<MobileAppBar align="left" right={marketsCount} titleChildren={marketsTitle} />

	<div class="hidden md:block">
		<SectionHeader
			description={t({ locale: $localeStore, key: 'markets.page.sub' })}
			highlight={t({ locale: $localeStore, key: 'markets.eyebrow' })}
			title={t({ locale: $localeStore, key: 'markets.page.title' })}
		/>
	</div>

	<div class="w-full space-y-5">
		<div class="space-y-5">
			<MarketFilters
				{activeTab}
				{filters}
				onFiltersChange={(f) => (filters = f)}
				onSearchChange={(term) => (searchTerm = term)}
				onTabChange={(tab) => (activeTab = tab)}
				{searchTerm}
				tabs={tabs.map((tab) => ({ id: tab, label: tabLabel(tab) }))}
			/>

			<div class="mx-auto flex max-w-4xl items-baseline justify-between px-1">
				<h2 class="eyebrow">{tabLabel(activeTab as (typeof tabs)[number])}</h2>
				<span class="num text-muted-foreground text-xs font-bold">{filteredMarkets.length}</span>
			</div>

			<MarketFeed
				emptyMessage={t({ locale: $localeStore, key: 'markets.empty' })}
				{loading}
				markets={filteredMarkets}
				onChallenge={handleChallenge}
			/>
		</div>
	</div>

	<ForkMarketModal
		isOpen={forkModalOpen}
		market={forkTarget}
		onClose={() => (forkModalOpen = false)}
	/>
</section>

<style lang="postcss">
	.markets-mobile-title {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-24);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
	}

	.markets-mobile-live {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border-radius: var(--r-4);
		background: var(--no-wash);
		padding: 0.2rem 0.45rem;
		color: var(--no);
		font-size: 0.625rem;
		font-weight: 800;
		letter-spacing: var(--tracking-allcaps);
		text-transform: uppercase;
	}

	.markets-mobile-live::before {
		width: 0.3rem;
		height: 0.3rem;
		border-radius: var(--r-pill);
		background: currentColor;
		content: '';
	}

	.markets-mobile-count {
		color: var(--text-muted);
		font-size: var(--t-12);
	}
</style>
