<script lang="ts">
    import { markets } from "../stores/markets";
    import { MarketStatus } from "../backend";
    import MarketCard from "../components/MarketCard.svelte";
    import Input from "../components/ui/Input.svelte";
    import { Search } from "lucide-svelte";

    export let onViewMarket: (marketId: bigint) => void;

    let searchQuery = "";
    let activeTab = "all";

    $: filteredMarkets = (() => {
        let filtered = $markets.markets;

        // Filter by search query
        if (searchQuery) {
            filtered = filtered.filter(
                (m) =>
                    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    m.description
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                    m.categories.some((c) =>
                        c.toLowerCase().includes(searchQuery.toLowerCase()),
                    ),
            );
        }

        // Filter by tab
        switch (activeTab) {
            case "trending":
                filtered = filtered.filter(
                    (m) => m.status === MarketStatus.open,
                );
                break;
            case "expiring":
                filtered = filtered
                    .filter((m) => m.status === MarketStatus.open)
                    .sort(
                        (a, b) => Number(a.expiration) - Number(b.expiration),
                    );
                break;
            case "resolved":
                filtered = filtered.filter(
                    (m) => m.status === MarketStatus.resolved,
                );
                break;
        }

        return filtered;
    })();

    const tabs = [
        { id: "all", label: "All Markets" },
        { id: "trending", label: "Trending" },
        { id: "expiring", label: "Expiring Soon" },
        { id: "resolved", label: "Resolved" },
    ];
</script>

<div class="container mx-auto px-4 py-8">
    <div class="space-y-6">
        <!-- Header -->
        <div class="space-y-2">
            <h1 class="text-4xl font-bold text-foreground">Markets</h1>
            <p class="text-muted-foreground">
                Explore and trade on prediction markets
            </p>
        </div>

        <!-- Search -->
        <div class="relative max-w-md">
            <Search
                class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                size={16}
            />
            <Input
                placeholder="Search markets..."
                bind:value={searchQuery}
                className="pl-10 h-10"
            />
        </div>

        <!-- Tabs -->
        <div class="space-y-6">
            <div
                class="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground bg-slate-100"
            >
                {#each tabs as tab}
                    <button
                        class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 {activeTab ===
                        tab.id
                            ? 'bg-white text-foreground shadow-sm'
                            : 'hover:bg-slate-200'}"
                        on:click={() => (activeTab = tab.id)}
                    >
                        {tab.label}
                    </button>
                {/each}
            </div>

            <div class="mt-6">
                {#if $markets.isLoading}
                    <div
                        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {#each Array(6) as _}
                            <div
                                class="h-64 rounded-lg bg-slate-100 animate-pulse"
                            ></div>
                        {/each}
                    </div>
                {:else if filteredMarkets.length > 0}
                    <div
                        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {#each filteredMarkets as market (market.id.toString())}
                            <MarketCard {market} {onViewMarket} />
                        {/each}
                    </div>
                {:else}
                    <div class="text-center py-16">
                        <p class="text-muted-foreground">
                            No markets found matching your criteria.
                        </p>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
