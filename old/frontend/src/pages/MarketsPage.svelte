<script lang="ts">
	import { markets } from '../stores/markets';
	import { MarketStatus } from '../backend';
	import MarketCard from '../components/MarketCard.svelte';
	import Input from '../components/ui/Input.svelte';
	import { Search } from 'lucide-svelte';

	export let onViewMarket: (marketId: bigint) => void;

	let searchQuery = '';
	let activeTab = 'all';

	$: filteredMarkets = (() => {
		let filtered = $markets.markets;

		// Filter by search query
		if (searchQuery) {
			filtered = filtered.filter(
				(m) =>
					m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
					m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
					m.categories.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
			);
		}

		// Filter by tab
		switch (activeTab) {
			case 'trending':
				filtered = filtered.filter((m) => m.status === MarketStatus.open);
				break;
			case 'expiring':
				filtered = filtered
					.filter((m) => m.status === MarketStatus.open)
					.sort((a, b) => Number(a.expiration) - Number(b.expiration));
				break;
			case 'resolved':
				filtered = filtered.filter((m) => m.status === MarketStatus.resolved);
				break;
		}

		return filtered;
	})();

	const tabs = [
		{ id: 'all', label: 'All Markets' },
		{ id: 'trending', label: 'Trending' },
		{ id: 'expiring', label: 'Expiring Soon' },
		{ id: 'resolved', label: 'Resolved' }
	];
</script>

<div class="container mx-auto px-4 py-8">
	<div class="space-y-6">
		<!-- Header -->
		<div class="space-y-2">
			<h1 class="text-foreground text-4xl font-bold">Markets</h1>
			<p class="text-muted-foreground">Explore and trade on prediction markets</p>
		</div>

		<!-- Search -->
		<div class="relative max-w-md">
			<Search
				class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
				size={16}
			/>
			<Input placeholder="Search markets..." bind:value={searchQuery} className="pl-10 h-10" />
		</div>

		<!-- Tabs -->
		<div class="space-y-6">
			<div
				class="bg-muted text-muted-foreground inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1"
			>
				{#each tabs as tab}
					<button
						class="focus-visible:ring-ring inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 {activeTab ===
						tab.id
							? 'text-foreground bg-white shadow-sm'
							: 'hover:bg-slate-200'}"
						on:click={() => (activeTab = tab.id)}
					>
						{tab.label}
					</button>
				{/each}
			</div>

			<div class="mt-6">
				{#if $markets.isLoading}
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{#each Array(6) as _}
							<div class="h-64 animate-pulse rounded-lg bg-slate-100"></div>
						{/each}
					</div>
				{:else if filteredMarkets.length > 0}
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{#each filteredMarkets as market (market.id.toString())}
							<MarketCard {market} {onViewMarket} />
						{/each}
					</div>
				{:else}
					<div class="py-16 text-center">
						<p class="text-muted-foreground">No markets found matching your criteria.</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
