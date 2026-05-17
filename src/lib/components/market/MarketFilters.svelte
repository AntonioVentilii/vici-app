<script lang="ts">
	import type {
		MarketAccessFilter,
		MarketKindFilter,
		MarketPayoutFilter,
		MarketSecondaryFilters
	} from '$lib/types/market-filters';

	interface Props {
		tabs: string[];
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
		'h-8 appearance-none rounded-[12px] border-none bg-muted pl-3 pr-7 text-xs font-bold text-foreground ring-1 ring-border ring-inset transition-all focus:ring-2 focus:ring-primary cursor-pointer';
</script>

<div class="space-y-4">
	<div class="flex flex-col items-center justify-between gap-6 lg:flex-row-reverse lg:items-start">
		<div class="relative w-full lg:max-w-sm">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
				<svg
					class="text-muted-foreground/60 size-5"
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
				class="bg-muted text-foreground placeholder-muted-foreground ring-border focus:bg-muted/80 focus:ring-primary block h-9 w-full rounded-[12px] border-none py-3 pr-4 pl-10 text-sm ring-1 transition-all ring-inset focus:ring-2"
				oninput={(e) => onSearchChange(e.currentTarget.value)}
				placeholder="Search markets..."
				type="text"
				value={searchTerm}
			/>
		</div>

		<div class="flex flex-wrap gap-1.5">
			{#each tabs as tab (tab)}
				<button
					class="rounded-full border px-3 py-1.5 text-xs font-medium transition-all {activeTab ===
					tab
						? 'border-primary/30 text-primary bg-laurel-glow'
						: 'border-border bg-foreground/6 text-muted-foreground hover:bg-foreground/10 hover:text-foreground'}"
					onclick={() => onTabChange(tab)}
				>
					{tab}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-3">
		<select
			class={selectClasses}
			aria-label="Filter by type"
			onchange={(e) =>
				onFiltersChange({ ...filters, kind: e.currentTarget.value as MarketKindFilter })}
			value={filters.kind}
		>
			<option value="all">All types</option>
			<option value="challenge">Challenges</option>
			<option value="market">Markets</option>
		</select>

		<select
			class={selectClasses}
			aria-label="Filter by stakes"
			onchange={(e) =>
				onFiltersChange({ ...filters, payout: e.currentTarget.value as MarketPayoutFilter })}
			value={filters.payout}
		>
			<option value="all">All stakes</option>
			<option value="vxp">VXP</option>
			<option value="non-monetary">Fun Dare</option>
		</select>

		<select
			class={selectClasses}
			aria-label="Filter by access"
			onchange={(e) =>
				onFiltersChange({ ...filters, access: e.currentTarget.value as MarketAccessFilter })}
			value={filters.access}
		>
			<option value="all">All access</option>
			<option value="open">Open</option>
			<option value="closed">Closed Circle</option>
		</select>

		{#if hasActiveFilters}
			<button
				class="text-muted-foreground hover:text-foreground text-[10px] font-bold tracking-widest uppercase transition-colors"
				onclick={clearFilters}
			>
				Clear filters
			</button>
		{/if}
	</div>
</div>
