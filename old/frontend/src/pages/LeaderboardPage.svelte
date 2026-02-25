<script lang="ts">
    import { leaderboard } from "../stores/leaderboard";
    import Card from "../components/ui/Card.svelte";
    import Avatar from "../components/ui/Avatar.svelte";
    import { Trophy, Medal, Award } from "lucide-svelte";

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return { component: Trophy, color: "text-yellow-500" };
            case 2:
                return { component: Medal, color: "text-slate-400" };
            case 3:
                return { component: Award, color: "text-amber-600" };
            default:
                return null;
        }
    };
</script>

<div class="container mx-auto px-4 py-8">
    <div class="space-y-8">
        <!-- Header -->
        <div class="text-center space-y-2">
            <h1 class="text-4xl font-bold text-foreground">Leaderboard</h1>
            <p class="text-muted-foreground">
                Top traders by Vici Coin balance
            </p>
        </div>

        <!-- Top 3 Podium -->
        {#if !$leaderboard.isLoading && $leaderboard.leaderboard.length >= 3}
            <div class="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
                <!-- 2nd Place -->
                <div class="flex flex-col items-center pt-12">
                    <div class="relative">
                        <Avatar
                            className="h-16 w-16 border-4 border-slate-300"
                            fallback="2"
                        />
                        <div
                            class="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white rounded-full p-1"
                        >
                            <Medal size={24} class="text-slate-400" />
                        </div>
                    </div>
                    <div class="mt-4 text-center">
                        <p
                            class="text-sm font-medium text-foreground truncate max-w-[100px]"
                        >
                            {$leaderboard.leaderboard[1][0]
                                .toString()
                                .slice(0, 8)}...
                        </p>
                        <p class="text-lg font-bold text-foreground">
                            Ꝟ {Number(
                                $leaderboard.leaderboard[1][1],
                            ).toLocaleString()}
                        </p>
                    </div>
                </div>

                <!-- 1st Place -->
                <div class="flex flex-col items-center">
                    <div class="relative">
                        <Avatar
                            className="h-20 w-20 border-4 border-yellow-500"
                            fallback="1"
                        />
                        <div
                            class="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white rounded-full p-1"
                        >
                            <Trophy size={32} class="text-yellow-500" />
                        </div>
                    </div>
                    <div class="mt-4 text-center">
                        <p
                            class="text-sm font-medium text-foreground truncate max-w-[100px]"
                        >
                            {$leaderboard.leaderboard[0][0]
                                .toString()
                                .slice(0, 8)}...
                        </p>
                        <p class="text-xl font-bold text-foreground">
                            Ꝟ {Number(
                                $leaderboard.leaderboard[0][1],
                            ).toLocaleString()}
                        </p>
                    </div>
                </div>

                <!-- 3rd Place -->
                <div class="flex flex-col items-center pt-16">
                    <div class="relative">
                        <Avatar
                            className="h-14 w-14 border-4 border-amber-600"
                            fallback="3"
                        />
                        <div
                            class="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white rounded-full p-1"
                        >
                            <Award size={20} class="text-amber-600" />
                        </div>
                    </div>
                    <div class="mt-4 text-center">
                        <p
                            class="text-sm font-medium text-foreground truncate max-w-[100px]"
                        >
                            {$leaderboard.leaderboard[2][0]
                                .toString()
                                .slice(0, 8)}...
                        </p>
                        <p class="text-lg font-bold text-foreground">
                            Ꝟ {Number(
                                $leaderboard.leaderboard[2][1],
                            ).toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>
        {/if}

        <!-- Full Leaderboard -->
        <Card className="max-w-4xl mx-auto">
            <div class="p-6">
                <h3 class="text-xl font-bold mb-6">All Rankings</h3>

                {#if $leaderboard.isLoading}
                    <div class="space-y-3">
                        {#each Array(10) as _}
                            <div
                                class="h-16 bg-slate-100 animate-pulse rounded"
                            ></div>
                        {/each}
                    </div>
                {:else if $leaderboard.leaderboard.length > 0}
                    <div class="space-y-2">
                        {#each $leaderboard.leaderboard as [principal, balance], index}
                            <div
                                class="flex items-center justify-between p-4 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                <div class="flex items-center gap-4">
                                    <div class="w-12 flex justify-center">
                                        {#if index < 3}
                                            {@const rankIcon = getRankIcon(
                                                index + 1,
                                            )}
                                            {#if rankIcon}
                                                <svelte:component
                                                    this={rankIcon.component}
                                                    size={24}
                                                    class={rankIcon.color}
                                                />
                                            {/if}
                                        {:else}
                                            <span
                                                class="text-lg font-bold text-muted-foreground"
                                                >#{index + 1}</span
                                            >
                                        {/if}
                                    </div>
                                    <Avatar
                                        className="h-10 w-10"
                                        fallback={(index + 1).toString()}
                                    />
                                    <div>
                                        <p class="font-medium text-foreground">
                                            {principal
                                                .toString()
                                                .slice(0, 12)}...
                                        </p>
                                        <p
                                            class="text-sm text-muted-foreground"
                                        >
                                            Rank #{index + 1}
                                        </p>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <p
                                        class="text-xl font-bold text-foreground"
                                    >
                                        Ꝟ {Number(balance).toLocaleString()}
                                    </p>
                                    <p class="text-sm text-muted-foreground">
                                        Vici Coins
                                    </p>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="text-center py-12 text-muted-foreground">
                        <p>No users on the leaderboard yet.</p>
                    </div>
                {/if}
            </div>
        </Card>
    </div>
</div>
