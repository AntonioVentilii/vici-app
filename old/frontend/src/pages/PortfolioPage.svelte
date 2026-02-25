<script lang="ts">
    import { portfolio } from "../stores/portfolio";
    import { userProfile } from "../stores/profile";
    import { markets } from "../stores/markets";
    import Card from "../components/ui/Card.svelte";
    import Badge from "../components/ui/Badge.svelte";
    import { TrendingUp, TrendingDown, Wallet, Activity } from "lucide-svelte";
    import { PositionType, Variant_trade_deposit_payout } from "../backend";

    export let onViewMarket: (marketId: bigint) => void;

    let activeTab = "positions";

    $: getMarketTitle = (marketId: bigint) => {
        const market = $markets.markets.find((m) => m.id === marketId);
        return market?.title || "Unknown Market";
    };

    $: formatDate = (timestamp: bigint) => {
        const date = new Date(Number(timestamp) / 1000000);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    $: totalInvested = $portfolio.positions.reduce(
        (sum, pos) => sum + Number(pos.amount),
        0,
    );
</script>

<div class="container mx-auto px-4 py-8">
    <div class="space-y-8">
        <!-- Header -->
        <div>
            <h1 class="text-4xl font-bold text-foreground">Portfolio</h1>
            <p class="text-muted-foreground mt-2">
                Track your positions and performance
            </p>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
                <div class="p-6">
                    <div
                        class="flex flex-row items-center justify-between space-y-0 pb-2"
                    >
                        <h3 class="text-sm font-medium">Total Balance</h3>
                        <Wallet size={16} class="text-muted-foreground" />
                    </div>
                    <div class="text-2xl font-bold">
                        Ꝟ {Number(
                            $userProfile?.profile?.balance || 0,
                        ).toLocaleString()}
                    </div>
                    <p class="text-xs text-muted-foreground">Vici Coins</p>
                </div>
            </Card>

            <Card>
                <div class="p-6">
                    <div
                        class="flex flex-row items-center justify-between space-y-0 pb-2"
                    >
                        <h3 class="text-sm font-medium">Open Positions</h3>
                        <Activity size={16} class="text-muted-foreground" />
                    </div>
                    <div class="text-2xl font-bold">
                        {$portfolio.positions.length}
                    </div>
                    <p class="text-xs text-muted-foreground">Active trades</p>
                </div>
            </Card>

            <Card>
                <div class="p-6">
                    <div
                        class="flex flex-row items-center justify-between space-y-0 pb-2"
                    >
                        <h3 class="text-sm font-medium">Total Invested</h3>
                        <TrendingUp size={16} class="text-muted-foreground" />
                    </div>
                    <div class="text-2xl font-bold">
                        Ꝟ {totalInvested.toLocaleString()}
                    </div>
                    <p class="text-xs text-muted-foreground">Vici Coins</p>
                </div>
            </Card>
        </div>

        <!-- Tabs -->
        <div class="space-y-6">
            <div
                class="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground bg-slate-100"
            >
                <button
                    class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab ===
                    'positions'
                        ? 'bg-white text-foreground shadow-sm'
                        : 'hover:bg-slate-200'}"
                    on:click={() => (activeTab = "positions")}
                >
                    Open Positions
                </button>
                <button
                    class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab ===
                    'transactions'
                        ? 'bg-white text-foreground shadow-sm'
                        : 'hover:bg-slate-200'}"
                    on:click={() => (activeTab = "transactions")}
                >
                    Transaction History
                </button>
            </div>

            <div class="mt-6">
                {#if activeTab === "positions"}
                    <Card>
                        <div class="p-6">
                            <h3 class="text-lg font-semibold mb-4">
                                Open Positions
                            </h3>
                            {#if $portfolio.isLoading}
                                <div class="space-y-3">
                                    {#each Array(3) as _}
                                        <div
                                            class="h-16 bg-slate-100 animate-pulse rounded"
                                        ></div>
                                    {/each}
                                </div>
                            {:else if $portfolio.positions.length > 0}
                                <div class="overflow-x-auto">
                                    <table
                                        class="w-full text-left border-collapse"
                                    >
                                        <thead>
                                            <tr class="border-b border-border">
                                                <th
                                                    class="py-3 px-4 font-semibold text-sm"
                                                    >Market</th
                                                >
                                                <th
                                                    class="py-3 px-4 font-semibold text-sm"
                                                    >Position</th
                                                >
                                                <th
                                                    class="py-3 px-4 font-semibold text-sm"
                                                    >Amount</th
                                                >
                                                <th
                                                    class="py-3 px-4 font-semibold text-sm"
                                                    >Odds</th
                                                >
                                                <th
                                                    class="py-3 px-4 font-semibold text-sm"
                                                    >Date</th
                                                >
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each $portfolio.positions as position}
                                                <tr
                                                    class="border-b border-border cursor-pointer hover:bg-slate-50 transition-colors"
                                                    on:click={() =>
                                                        onViewMarket(
                                                            position.marketId,
                                                        )}
                                                >
                                                    <td
                                                        class="py-3 px-4 font-medium"
                                                        >{getMarketTitle(
                                                            position.marketId,
                                                        )}</td
                                                    >
                                                    <td class="py-3 px-4">
                                                        {#if position.positionType === PositionType.yes}
                                                            <Badge
                                                                className="bg-emerald-500 text-white border-emerald-500"
                                                            >
                                                                <TrendingUp
                                                                    size={12}
                                                                    class="mr-1"
                                                                />
                                                                Yes
                                                            </Badge>
                                                        {:else}
                                                            <Badge
                                                                variant="destructive"
                                                            >
                                                                <TrendingDown
                                                                    size={12}
                                                                    class="mr-1"
                                                                />
                                                                No
                                                            </Badge>
                                                        {/if}
                                                    </td>
                                                    <td
                                                        class="py-3 px-4 font-mono"
                                                        >Ꝟ {Number(
                                                            position.amount,
                                                        ).toLocaleString()}</td
                                                    >
                                                    <td class="py-3 px-4"
                                                        >{Math.round(
                                                            position.odds * 100,
                                                        )}¢</td
                                                    >
                                                    <td
                                                        class="py-3 px-4 text-muted-foreground text-sm"
                                                    >
                                                        {formatDate(
                                                            position.createdAt,
                                                        )}
                                                    </td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                            {:else}
                                <div
                                    class="text-center py-12 text-muted-foreground"
                                >
                                    <p>
                                        No open positions yet. Start trading to
                                        see your positions here!
                                    </p>
                                </div>
                            {/if}
                        </div>
                    </Card>
                {:else}
                    <Card>
                        <div class="p-6">
                            <h3 class="text-lg font-semibold mb-4">
                                Transaction History
                            </h3>
                            {#if $portfolio.isLoading}
                                <div class="space-y-3">
                                    {#each Array(5) as _}
                                        <div
                                            class="h-16 bg-slate-100 animate-pulse rounded"
                                        ></div>
                                    {/each}
                                </div>
                            {:else if $portfolio.transactions.length > 0}
                                <div class="overflow-x-auto">
                                    <table
                                        class="w-full text-left border-collapse"
                                    >
                                        <thead>
                                            <tr class="border-b border-border">
                                                <th
                                                    class="py-3 px-4 font-semibold text-sm"
                                                    >Type</th
                                                >
                                                <th
                                                    class="py-3 px-4 font-semibold text-sm"
                                                    >Market</th
                                                >
                                                <th
                                                    class="py-3 px-4 font-semibold text-sm"
                                                    >Amount</th
                                                >
                                                <th
                                                    class="py-3 px-4 font-semibold text-sm"
                                                    >Date</th
                                                >
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each $portfolio.transactions as tx}
                                                <tr
                                                    class="border-b border-border"
                                                >
                                                    <td class="py-3 px-4">
                                                        <Badge
                                                            variant={tx.transactionType ===
                                                            Variant_trade_deposit_payout.deposit
                                                                ? "default"
                                                                : tx.transactionType ===
                                                                    Variant_trade_deposit_payout.payout
                                                                  ? "default"
                                                                  : "secondary"}
                                                        >
                                                            {tx.transactionType ===
                                                            Variant_trade_deposit_payout.trade
                                                                ? "Trade"
                                                                : tx.transactionType ===
                                                                    Variant_trade_deposit_payout.deposit
                                                                  ? "Deposit"
                                                                  : "Payout"}
                                                        </Badge>
                                                    </td>
                                                    <td
                                                        class="py-3 px-4 text-sm"
                                                    >
                                                        {tx.marketId
                                                            ? getMarketTitle(
                                                                  tx.marketId,
                                                              )
                                                            : "-"}
                                                    </td>
                                                    <td
                                                        class="py-3 px-4 font-mono {tx.transactionType ===
                                                        Variant_trade_deposit_payout.trade
                                                            ? 'text-rose-600'
                                                            : 'text-emerald-600'}"
                                                    >
                                                        {tx.transactionType ===
                                                        Variant_trade_deposit_payout.trade
                                                            ? "-"
                                                            : "+"}
                                                        Ꝟ {Number(
                                                            tx.amount,
                                                        ).toLocaleString()}
                                                    </td>
                                                    <td
                                                        class="py-3 px-4 text-muted-foreground text-sm"
                                                    >
                                                        {formatDate(
                                                            tx.createdAt,
                                                        )}
                                                    </td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                            {:else}
                                <div
                                    class="text-center py-12 text-muted-foreground"
                                >
                                    <p>No transactions yet.</p>
                                </div>
                            {/if}
                        </div>
                    </Card>
                {/if}
            </div>
        </div>
    </div>
</div>
