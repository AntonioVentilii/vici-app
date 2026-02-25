<script lang="ts">
    import { wallet } from "../stores/wallet";
    import Card from "../components/ui/Card.svelte";
    import {
        Wallet,
        TrendingUp,
        TrendingDown,
        ArrowUpRight,
        ArrowDownLeft,
    } from "lucide-svelte";
    import SendTokenForm from "../components/SendTokenForm.svelte";
    import ReceiveTokenPanel from "../components/ReceiveTokenPanel.svelte";

    let activeTab = "send";

    const formatBalance = (amount: bigint | null | undefined) => {
        if (amount === null || amount === undefined) return "0.00";
        const value = Number(amount) / 100_000_000;
        return value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8,
        });
    };
</script>

<div class="container mx-auto px-4 py-8 max-w-6xl">
    <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center gap-3">
            <div class="p-3 rounded-full bg-primary/10">
                <Wallet size={24} class="text-primary" />
            </div>
            <div>
                <h1 class="text-3xl font-bold">Wallet</h1>
                <p class="text-muted-foreground">
                    Manage your ICP and ckUSDC tokens
                </p>
            </div>
        </div>

        <!-- Balance Cards -->
        <div class="grid md:grid-cols-2 gap-6">
            <!-- ICP Balance -->
            <Card>
                <div class="p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <h3 class="font-semibold">ICP Balance</h3>
                        <TrendingUp size={20} class="text-primary" />
                    </div>
                    <p class="text-sm text-muted-foreground">
                        Internet Computer Protocol
                    </p>
                    {#if $wallet.isLoading}
                        <div
                            class="h-10 bg-slate-100 animate-pulse rounded"
                        ></div>
                    {:else}
                        <div class="space-y-2">
                            <p class="text-4xl font-bold">
                                {formatBalance($wallet.balance?.icp)}
                            </p>
                            <p class="text-sm text-muted-foreground">ICP</p>
                        </div>
                    {/if}
                </div>
            </Card>

            <!-- ckUSDC Balance -->
            <Card>
                <div class="p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <h3 class="font-semibold">ckUSDC Balance</h3>
                        <TrendingDown size={20} class="text-primary" />
                    </div>
                    <p class="text-sm text-muted-foreground">
                        Chain-Key USD Coin
                    </p>
                    {#if $wallet.isLoading}
                        <div
                            class="h-10 bg-slate-100 animate-pulse rounded"
                        ></div>
                    {:else}
                        <div class="space-y-2">
                            <p class="text-4xl font-bold">
                                {formatBalance($wallet.balance?.ckUSDC)}
                            </p>
                            <p class="text-sm text-muted-foreground">ckUSDC</p>
                        </div>
                    {/if}
                </div>
            </Card>
        </div>

        <!-- Send/Receive Tabs -->
        <Card>
            <div class="p-6 space-y-6">
                <div class="space-y-1">
                    <h3 class="text-lg font-semibold">Transactions</h3>
                    <p class="text-sm text-muted-foreground">
                        Send or receive tokens
                    </p>
                </div>

                <div
                    class="inline-flex h-10 w-full items-center justify-center rounded-md bg-muted p-1 text-muted-foreground bg-slate-100"
                >
                    <button
                        class="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab ===
                        'send'
                            ? 'bg-white text-foreground shadow-sm'
                            : 'hover:bg-slate-200'}"
                        on:click={() => (activeTab = "send")}
                    >
                        <ArrowUpRight size={16} class="mr-2" />
                        Send
                    </button>
                    <button
                        class="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all {activeTab ===
                        'receive'
                            ? 'bg-white text-foreground shadow-sm'
                            : 'hover:bg-slate-200'}"
                        on:click={() => (activeTab = "receive")}
                    >
                        <ArrowDownLeft size={16} class="mr-2" />
                        Receive
                    </button>
                </div>

                <div class="mt-6">
                    {#if activeTab === "send"}
                        <SendTokenForm
                            currentBalance={$wallet.balance || undefined}
                        />
                    {:else}
                        <ReceiveTokenPanel />
                    {/if}
                </div>
            </div>
        </Card>

        <!-- Info Card -->
        <Card className="bg-slate-50">
            <div class="p-6 space-y-2 text-sm text-muted-foreground">
                <h3 class="text-lg font-semibold text-foreground">
                    About IC Wallet
                </h3>
                <p>
                    This wallet allows you to manage ICP (Internet Computer
                    Protocol) and ckUSDC (Chain-Key USD Coin) tokens on the
                    Internet Computer blockchain.
                </p>
                <p>
                    <strong>Note:</strong> This is a demonstration wallet. In production,
                    transactions would interact with the ICP Ledger and ckUSDC Ledger
                    canisters via inter-canister calls.
                </p>
            </div>
        </Card>
    </div>
</div>
