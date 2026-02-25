<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { markets } from "../stores/markets";
    import { backend } from "../stores/actor";
    import { userProfile } from "../stores/profile";
    import Button from "../components/ui/Button.svelte";
    import Input from "../components/ui/Input.svelte";
    import Card from "../components/ui/Card.svelte";
    import Badge from "../components/ui/Badge.svelte";
    import { ArrowLeft, ArrowRight, ArrowUp, Loader2, X } from "lucide-svelte";
    import { toast } from "sonner";

    export let onNavigate: (page: string) => void;

    let currentIndex = 0;
    let tradeAmount = "100";
    let isProcessing = false;
    let touchStart: number | null = null;
    let touchEnd: number | null = null;
    const minSwipeDistance = 50;

    $: rushMarkets = $markets.markets
        .filter((m) => m.status === "open")
        .slice(0, 10);

    $: currentMarket = rushMarkets[currentIndex];
    $: isLoading = $markets.isLoading;

    const handleKeyDown = (e: KeyboardEvent) => {
        if (isProcessing || !currentMarket) return;

        if (e.key === "ArrowRight") {
            e.preventDefault();
            handleYes();
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            handleNo();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            handleSkip();
        }
    };

    onMount(() => {
        window.addEventListener("keydown", handleKeyDown);
    });

    onDestroy(() => {
        window.removeEventListener("keydown", handleKeyDown);
    });

    const onTouchStart = (e: TouchEvent) => {
        touchEnd = null;
        touchStart = e.touches[0].clientX;
    };

    const onTouchMove = (e: TouchEvent) => {
        touchEnd = e.touches[0].clientX;
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd || isProcessing) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            handleNo();
        } else if (isRightSwipe) {
            handleYes();
        }
    };

    const handleYes = () => executeTrade("yes");
    const handleNo = () => executeTrade("no");
    const handleSkip = () => advanceToNext();

    const executeTrade = async (positionType: "yes" | "no") => {
        if (!currentMarket || isProcessing) return;

        const amount = parseInt(tradeAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Please enter a valid trade amount");
            return;
        }

        isProcessing = true;
        try {
            const { actor } = $backend;
            if (!actor) throw new Error("Actor not available");

            await actor.placePosition(
                currentMarket.id,
                positionType as any,
                BigInt(amount),
            );

            toast.success(
                `Trade placed: ${positionType.toUpperCase()} for Ꝟ ${amount}`,
            );
            advanceToNext();
            userProfile.refresh();
        } catch (error: any) {
            toast.error(error.message || "Failed to place trade");
        } finally {
            isProcessing = false;
        }
    };

    const advanceToNext = () => {
        if (currentIndex < rushMarkets.length - 1) {
            currentIndex++;
        } else {
            toast.success("Rush complete! All markets reviewed.");
            onNavigate("markets");
        }
    };

    const formatDate = (timestamp: bigint) => {
        return new Date(Number(timestamp) / 1000000).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" },
        );
    };
</script>

<div class="container mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
        <div class="flex items-center space-x-4">
            <h1 class="text-2xl font-bold text-foreground">Rush Mode</h1>
            {#if rushMarkets.length > 0}
                <Badge variant="secondary" class="text-sm">
                    {currentIndex + 1} / {rushMarkets.length}
                </Badge>
            {/if}
        </div>
        <Button variant="outline" on:click={() => onNavigate("markets")}>
            <X size={16} class="mr-2" />
            Exit
        </Button>
    </div>

    {#if isLoading && rushMarkets.length === 0}
        <div class="flex items-center justify-center min-h-[60vh]">
            <Loader2 class="h-8 w-8 animate-spin text-primary" />
        </div>
    {:else if rushMarkets.length === 0}
        <div
            class="flex flex-col items-center justify-center min-h-[60vh] space-y-6"
        >
            <div class="text-center space-y-2">
                <h2 class="text-2xl font-bold text-foreground">
                    No Markets Available
                </h2>
                <p class="text-muted-foreground max-w-md">
                    There are no eligible open markets at the moment. Check back
                    later or browse all markets.
                </p>
            </div>
            <Button on:click={() => onNavigate("markets")} size="lg">
                Browse Markets
            </Button>
        </div>
    {:else if currentMarket}
        <!-- Instructions -->
        <div class="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p class="text-sm text-muted-foreground text-center">
                <span class="font-semibold">Swipe or use keyboard:</span> Right/→
                = YES • Left/← = NO • Up/↑ = Skip
            </p>
        </div>

        <!-- Market Card -->
        <div
            class="max-w-2xl mx-auto"
            on:touchstart={onTouchStart}
            on:touchmove={onTouchMove}
            on:touchend={onTouchEnd}
        >
            <Card className="mb-6">
                <div class="p-6 space-y-4">
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex-1">
                            <h3 class="text-xl font-bold mb-2">
                                {currentMarket.title}
                            </h3>
                            <p class="text-sm text-muted-foreground">
                                {currentMarket.description}
                            </p>
                        </div>
                        {#if currentMarket.inviteOnly}
                            <Badge variant="outline" class="shrink-0"
                                >Invite Only</Badge
                            >
                        {/if}
                    </div>

                    {#if currentMarket.categories.length > 0}
                        <div class="flex flex-wrap gap-2">
                            {#each currentMarket.categories as category}
                                <Badge variant="secondary" class="text-xs"
                                    >{category}</Badge
                                >
                            {/each}
                        </div>
                    {/if}

                    <div class="grid grid-cols-2 gap-4">
                        <div
                            class="p-4 bg-green-50 border border-green-100 rounded-lg"
                        >
                            <div class="text-xs text-muted-foreground mb-1">
                                YES Odds
                            </div>
                            <div class="text-2xl font-bold text-green-600">
                                {(currentMarket.oddsYes * 100).toFixed(0)}%
                            </div>
                        </div>
                        <div
                            class="p-4 bg-red-50 border border-red-100 rounded-lg"
                        >
                            <div class="text-xs text-muted-foreground mb-1">
                                NO Odds
                            </div>
                            <div class="text-2xl font-bold text-red-600">
                                {(currentMarket.oddsNo * 100).toFixed(0)}%
                            </div>
                        </div>
                    </div>

                    <div class="text-sm text-muted-foreground">
                        Expires: {formatDate(currentMarket.expiration)}
                    </div>

                    <div class="space-y-2">
                        <label for="trade-amount" class="text-sm font-medium"
                            >Trade Amount (Ꝟ)</label
                        >
                        <Input
                            id="trade-amount"
                            type="number"
                            bind:value={tradeAmount}
                            placeholder="100"
                            min="1"
                            disabled={isProcessing}
                        />
                    </div>
                </div>
            </Card>

            <!-- Action Buttons -->
            <div class="grid grid-cols-3 gap-4">
                <Button
                    variant="destructive"
                    class="h-20 flex flex-col items-center justify-center"
                    on:click={handleNo}
                    disabled={isProcessing}
                >
                    {#if isProcessing}
                        <Loader2 size={24} class="animate-spin" />
                    {:else}
                        <ArrowLeft size={24} class="mb-1" />
                        <span class="text-sm font-bold">NO</span>
                    {/if}
                </Button>

                <Button
                    variant="outline"
                    class="h-20 flex flex-col items-center justify-center border-2"
                    on:click={handleSkip}
                    disabled={isProcessing}
                >
                    <ArrowUp size={24} class="mb-1" />
                    <span class="text-sm font-bold">Skip</span>
                </Button>

                <Button
                    class="h-20 flex flex-col items-center justify-center bg-green-600 hover:bg-green-700 text-white"
                    on:click={handleYes}
                    disabled={isProcessing}
                >
                    {#if isProcessing}
                        <Loader2 size={24} class="animate-spin" />
                    {:else}
                        <ArrowRight size={24} class="mb-1" />
                        <span class="text-sm font-bold">YES</span>
                    {/if}
                </Button>
            </div>
        </div>
    {/if}
</div>
