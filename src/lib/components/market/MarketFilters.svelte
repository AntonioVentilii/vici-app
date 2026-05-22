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
</script>

<div class="market-filters">
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
				class="market-search"
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
					class="market-tab"
					class:is-active={activeTab === tab.id}
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
			class="market-select"
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
			class="market-select"
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
			class="market-select"
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
				class="text-muted-foreground hover:text-foreground eyebrow-xs rounded-full px-2 py-1 transition-colors"
				onclick={clearFilters}
				type="button"
			>
				{t({ locale: $localeStore, key: 'markets.filter.clear' })}
			</button>
		{/if}
	</div>
</div>

<style lang="postcss">
	.market-filters {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		border: 1px solid var(--border-base);
		border-radius: 1rem;
		background: color-mix(in srgb, var(--bg-surface) 92%, transparent);
		padding: 0.75rem;
		box-shadow: var(--shadow-card);
	}

	.market-search {
		display: block;
		width: 100%;
		height: 2.5rem;
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-popover);
		padding: 0.75rem 1rem 0.75rem 2.25rem;
		color: var(--text-base);
		font-size: var(--t-14);
		outline: none;
		box-shadow: var(--inset-hi);
		transition:
			border-color var(--d-hover) var(--ease-vici),
			box-shadow var(--d-hover) var(--ease-vici);
	}

	.market-search::placeholder {
		color: var(--text-muted);
	}

	.market-search:focus {
		border-color: var(--color-primary);
		box-shadow:
			var(--inset-hi),
			0 0 0 2px var(--laurel-glow);
	}

	.market-tab,
	.market-select {
		border: 1px solid var(--border-base);
		border-radius: var(--r-pill);
		background: var(--bg-surface);
		color: var(--text-muted);
		font-weight: 700;
		transition:
			background-color var(--d-hover) var(--ease-vici),
			border-color var(--d-hover) var(--ease-vici),
			color var(--d-hover) var(--ease-vici);
	}

	.market-tab {
		flex-shrink: 0;
		padding: 0.375rem 0.75rem;
		font-size: var(--t-12);
	}

	.market-tab:hover,
	.market-select:hover {
		border-color: var(--border-strong);
		color: var(--text-base);
	}

	.market-tab.is-active {
		border-color: color-mix(in srgb, var(--color-primary) 34%, var(--border-base));
		background: var(--laurel-glow);
		color: var(--color-primary);
		box-shadow: var(--shadow-card);
	}

	.market-select {
		height: 2.25rem;
		appearance: none;
		cursor: pointer;
		padding: 0 2rem 0 0.75rem;
		font-size: var(--t-12);
		outline: none;
	}

	.market-select:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px var(--laurel-glow);
	}

	@media (min-width: 640px) {
		.market-filters {
			padding: 1rem;
		}
	}
</style>
