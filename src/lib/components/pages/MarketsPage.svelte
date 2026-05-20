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

<section class="space-y-8">
	<SectionHeader
		description={t({ locale: $localeStore, key: 'markets.page.sub' })}
		highlight={t({ locale: $localeStore, key: 'markets.eyebrow' })}
		title={t({ locale: $localeStore, key: 'markets.page.title' })}
	/>

	<div class="w-full space-y-8">
		<div class="space-y-8">
			<MarketFilters
				{activeTab}
				{filters}
				onFiltersChange={(f) => (filters = f)}
				onSearchChange={(term) => (searchTerm = term)}
				onTabChange={(tab) => (activeTab = tab)}
				{searchTerm}
				tabs={tabs.map((tab) => ({ id: tab, label: tabLabel(tab) }))}
			/>

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
