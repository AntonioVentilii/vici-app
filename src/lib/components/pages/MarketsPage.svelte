<script lang="ts">
	import { onMount } from 'svelte';
	import ForkMarketModal from '$lib/components/challenge/ForkMarketModal.svelte';
	import MarketFeed from '$lib/components/market/MarketFeed.svelte';
	import MarketFilters from '$lib/components/market/MarketFilters.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { markets, marketsNotInitialized } from '$lib/derived/markets.derived';
	import { listSeriesCategories } from '$lib/services/category.services';
	import { localeStore } from '$lib/stores/locale.store';
	import { userStore } from '$lib/stores/user.store';
	import type { SeriesCategory } from '$lib/types/category';
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
	let categoryMappings = $state<SeriesCategory[]>([]);

	let forkModalOpen = $state(false);
	let forkTarget = $state<Market | null>(null);

	const handleChallenge = (market: Market) => {
		forkTarget = market;
		forkModalOpen = true;
	};

	onMount(async () => {
		categoryMappings = await listSeriesCategories();
	});

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
			categoryMappings
		})
	);
</script>

<section class="space-y-6">
	<div class="mobile-markets-appbar">
		<div class="flex items-center gap-2">
			<h1>{t({ locale: $localeStore, key: 'nav.markets' })}</h1>
			<span>{t({ locale: $localeStore, key: 'hero.live' })}</span>
		</div>
		<strong class="num">{filteredMarkets.length}</strong>
	</div>

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
	.mobile-markets-appbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-inline: 0.25rem;
	}

	.mobile-markets-appbar h1 {
		margin: 0;
		color: var(--text-base);
		font-size: var(--t-24);
		font-weight: 700;
		letter-spacing: var(--tracking-tight);
	}

	.mobile-markets-appbar span {
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

	.mobile-markets-appbar span::before {
		width: 0.3rem;
		height: 0.3rem;
		border-radius: var(--r-pill);
		background: currentColor;
		content: '';
	}

	.mobile-markets-appbar strong {
		color: var(--text-muted);
		font-size: var(--t-12);
	}

	@media (min-width: 768px) {
		.mobile-markets-appbar {
			display: none;
		}
	}
</style>
