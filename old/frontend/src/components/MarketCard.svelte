<script lang="ts">
    import { MarketStatus } from "../backend";
    import Badge from "./ui/Badge.svelte";
    import Card from "./ui/Card.svelte";
    import { Clock, Lock } from "lucide-svelte";
    import type { MarketSnapshot } from "../backend";

    export let market: MarketSnapshot;
    export let onViewMarket: (marketId: bigint) => void;

    const formatDate = (timestamp: bigint) => {
        const date = new Date(Number(timestamp) / 1000000);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const isExpiringSoon = () => {
        const now = Date.now() * 1000000;
        const timeLeft = Number(market.expiration) - now;
        const daysLeft = timeLeft / (1000000 * 1000 * 60 * 60 * 24);
        return daysLeft < 7 && daysLeft > 0;
    };
</script>

<Card
    className="hover:shadow-lg transition-shadow cursor-pointer group h-full"
    on:click={() => onViewMarket(market.id)}
>
    <div class="p-6 space-y-3">
        <div class="flex items-start justify-between gap-2">
            <h3
                class="text-lg font-semibold leading-tight group-hover:text-primary transition-colors"
            >
                {market.title}
            </h3>
            <div class="flex gap-1">
                {#if market.status === MarketStatus.open}
                    <Badge
                        className="bg-emerald-500 text-white border-emerald-500"
                        >Open</Badge
                    >
                {:else if market.status === MarketStatus.closed}
                    <Badge variant="secondary">Closed</Badge>
                {:else if market.status === MarketStatus.resolved}
                    <Badge variant="outline">Resolved</Badge>
                {/if}

                {#if market.inviteOnly}
                    <Badge variant="outline" className="gap-1">
                        <Lock size={12} />
                    </Badge>
                {/if}
            </div>
        </div>
        <div class="flex flex-wrap gap-2">
            {#each market.categories as category}
                <Badge variant="secondary" className="text-xs">
                    {category}
                </Badge>
            {/each}
        </div>
    </div>

    <div class="px-6 pb-6 space-y-4">
        <p class="text-sm text-muted-foreground line-clamp-2">
            {market.description}
        </p>

        <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
                <div class="text-xs text-muted-foreground">Yes</div>
                <div class="text-2xl font-bold text-emerald-600">
                    {Math.round(market.oddsYes * 100)}¢
                </div>
            </div>
            <div class="space-y-1">
                <div class="text-xs text-muted-foreground">No</div>
                <div class="text-2xl font-bold text-rose-600">
                    {Math.round(market.oddsNo * 100)}¢
                </div>
            </div>
        </div>

        <div
            class="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border"
        >
            <div class="flex items-center gap-1">
                <Clock size={12} />
                <span>{formatDate(market.expiration)}</span>
            </div>
            {#if isExpiringSoon()}
                <Badge
                    variant="outline"
                    className="text-xs border-destructive text-destructive"
                >
                    Expiring Soon
                </Badge>
            {/if}
        </div>
    </div>
</Card>
