<script lang="ts">
	import { localeStore } from '$lib/stores/locale.store';
	import type {
		MarketAccessFilter,
		MarketKindFilter,
		MarketPayoutFilter,
		MarketSecondaryFilters
	} from '$lib/types/market-filters';
	import { t } from '$lib/utils/i18n.utils';

	interface TabOption {
		id: string;
		label: string;
	}

	interface Props {
		tabs: readonly TabOption[];
		activeTab: string;
		searchTerm: string;
		filters: MarketSecondaryFilters;
		onTabChange: (tab: string) => void;
		onSearchChange: (term: string) => void;
		onFiltersChange: (filters: MarketSecondaryFilters) => void;
	}

	const {
		tabs,
		activeTab,
		searchTerm,
		filters,
		onTabChange,
		onSearchChange,
		onFiltersChange
	}: Props = $props();

	const hasActiveFilters = $derived(
		filters.kind !== 'all' || filters.payout !== 'all' || filters.access !== 'all'
	);

	const clearFilters = () => onFiltersChange({ kind: 'all', payout: 'all', access: 'all' });

	const selectClasses =
		'h-9 appearance-none rounded-full border border-border bg-card/80 px-3 pr-8 text-xs font-bold text-foreground shadow-card transition-all focus:border-primary focus:ring-2 focus:ring-primary/30 cursor-pointer';
</script>

<div class="surface space-y-4 rounded-2xl p-3 sm:p-4">
	<div
		class="flex flex-col items-stretch justify-between gap-3 lg:flex-row-reverse lg:items-center"
	>
		<div class="relative w-full lg:max-w-sm">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
				<svg
					class="text-muted-foreground/60 size-4"
					aria-hidden="true"
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path
						clip-rule="evenodd"
						d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
						fill-rule="evenodd"
					/>
				</svg>
			</div>
			<input
				class="bg-foreground/5 text-foreground placeholder-muted-foreground ring-border focus:bg-foreground/8 focus:ring-primary block h-10 w-full rounded-full border-none py-3 pr-4 pl-9 text-sm ring-1 transition-all ring-inset focus:ring-2"
				aria-label={t({ locale: $localeStore, key: 'markets.search' })}
				oninput={(e) => onSearchChange(e.currentTarget.value)}
				placeholder={t({ locale: $localeStore, key: 'markets.search' })}
				type="text"
				value={searchTerm}
			/>
		</div>

		<div class="flex gap-1.5 overflow-x-auto pb-1">
			{#each tabs as tab (tab.id)}
				<button
					class="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all {activeTab ===
					tab.id
						? 'border-primary/30 text-primary bg-laurel-glow shadow-card'
						: 'border-border bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground'}"
					aria-pressed={activeTab === tab.id}
					onclick={() => onTabChange(tab.id)}
					type="button"
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<select
			class={selectClasses}
			aria-label={t({ locale: $localeStore, key: 'markets.filter.type' })}
			onchange={(e) =>
				onFiltersChange({ ...filters, kind: e.currentTarget.value as MarketKindFilter })}
			value={filters.kind}
		>
			<option value="all">{t({ locale: $localeStore, key: 'markets.filter.type.all' })}</option>
			<option value="challenge"
				>{t({ locale: $localeStore, key: 'markets.filter.type.challenge' })}</option
			>
			<option value="market"
				>{t({ locale: $localeStore, key: 'markets.filter.type.market' })}</option
			>
		</select>

		<select
			class={selectClasses}
			aria-label={t({ locale: $localeStore, key: 'markets.filter.stakes' })}
			onchange={(e) =>
				onFiltersChange({ ...filters, payout: e.currentTarget.value as MarketPayoutFilter })}
			value={filters.payout}
		>
			<option value="all">{t({ locale: $localeStore, key: 'markets.filter.stakes.all' })}</option>
			<option value="vxp">{t({ locale: $localeStore, key: 'markets.filter.stakes.vxp' })}</option>
			<option value="non-monetary"
				>{t({ locale: $localeStore, key: 'markets.filter.stakes.fun' })}</option
			>
		</select>

		<select
			class={selectClasses}
			aria-label={t({ locale: $localeStore, key: 'markets.filter.access' })}
			onchange={(e) =>
				onFiltersChange({ ...filters, access: e.currentTarget.value as MarketAccessFilter })}
			value={filters.access}
		>
			<option value="all">{t({ locale: $localeStore, key: 'markets.filter.access.all' })}</option>
			<option value="open">{t({ locale: $localeStore, key: 'markets.filter.access.open' })}</option>
			<option value="closed"
				>{t({ locale: $localeStore, key: 'markets.filter.access.closed' })}</option
			>
		</select>

		{#if hasActiveFilters}
			<button
				class="text-muted-foreground hover:text-foreground rounded-full px-2 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors"
				onclick={clearFilters}
				type="button"
			>
				{t({ locale: $localeStore, key: 'markets.filter.clear' })}
			</button>
		{/if}
	</div>
</div>
