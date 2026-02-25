<script lang="ts">
    import { auth, isAuthenticated, loginStatus } from "../stores/auth";
    import { userProfile, isAdmin } from "../stores/profile";
    import Button from "./ui/Button.svelte";
    import Avatar from "./ui/Avatar.svelte";
    import { Menu, X, User, LogOut, Shield, Zap, Wallet } from "lucide-svelte";
    import { cn } from "../lib/utils";

    export let currentPage: string;
    export let onNavigate: (page: string) => void;

    let mobileMenuOpen = false;
    let dropdownOpen = false;

    $: disabled = $loginStatus === "logging-in";

    const handleAuth = async () => {
        if ($isAuthenticated) {
            await auth.clear();
            onNavigate("home");
        } else {
            try {
                await auth.login();
            } catch (error) {
                console.error("Login error:", error);
            }
        }
    };

    const navItems = [
        { label: "Home", page: "home" },
        { label: "Markets", page: "markets" },
        { label: "Rush", page: "rush", authRequired: true, icon: Zap },
        { label: "Portfolio", page: "portfolio", authRequired: true },
        { label: "Wallet", page: "wallet", authRequired: true, icon: Wallet },
        { label: "Leaderboard", page: "leaderboard" },
        { label: "Learn", page: "learn" },
    ];
</script>

<header
    class="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
>
    <div class="container mx-auto px-4">
        <div class="flex h-16 items-center justify-between">
            <!-- Logo -->
            <button
                on:click={() => onNavigate("home")}
                class="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
                <img
                    src="/assets/vici-coin-logo-transparent.dim_200x200.png"
                    alt="Vici"
                    class="h-8 w-8"
                />
                <span class="text-xl font-bold text-primary">Vici</span>
            </button>

            <!-- Desktop Navigation -->
            <nav class="hidden md:flex items-center space-x-1">
                {#each navItems as item}
                    {#if !item.authRequired || $isAuthenticated}
                        <Button
                            variant={currentPage === item.page
                                ? "default"
                                : "ghost"}
                            on:click={() => onNavigate(item.page)}
                            className="flex items-center gap-2"
                        >
                            {#if item.icon}
                                <svelte:component this={item.icon} size={16} />
                            {/if}
                            {item.label}
                        </Button>
                    {/if}
                {/each}
                {#if $isAdmin}
                    <Button
                        variant={currentPage === "admin" ? "default" : "ghost"}
                        on:click={() => onNavigate("admin")}
                        className="flex items-center gap-2"
                    >
                        <Shield size={16} />
                        Admin
                    </Button>
                {/if}
            </nav>

            <!-- User Section -->
            <div class="flex items-center space-x-4">
                {#if $isAuthenticated && $userProfile?.profile}
                    <div
                        class="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold"
                    >
                        <span class="text-lg">Ꝟ</span>
                        <span
                            >{Number(
                                $userProfile.profile.balance,
                            ).toLocaleString()}</span
                        >
                    </div>
                {/if}

                {#if $isAuthenticated}
                    <div class="relative">
                        <button
                            class="relative h-10 w-10 rounded-full overflow-hidden border border-border"
                            on:click={() => (dropdownOpen = !dropdownOpen)}
                        >
                            <Avatar
                                src={$userProfile?.profile?.avatar}
                                alt={$userProfile?.profile?.nickname}
                                fallback={$userProfile?.profile?.nickname
                                    ?.charAt(0)
                                    .toUpperCase() || "U"}
                            />
                        </button>

                        {#if dropdownOpen}
                            <div
                                class="absolute right-0 mt-2 w-56 rounded-md border border-border bg-popover text-popover-foreground shadow-md z-50"
                            >
                                <div class="py-1">
                                    <button
                                        class="flex w-full items-center px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                        on:click={() => {
                                            onNavigate("profile");
                                            dropdownOpen = false;
                                        }}
                                    >
                                        <User size={16} class="mr-2" />
                                        Profile
                                    </button>
                                    <button
                                        class="flex w-full items-center px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-destructive"
                                        on:click={() => {
                                            handleAuth();
                                            dropdownOpen = false;
                                        }}
                                    >
                                        <LogOut size={16} class="mr-2" />
                                        Logout
                                    </button>
                                </div>
                            </div>
                            <!-- Click outside handler -->
                            <div
                                class="fixed inset-0 z-40"
                                on:click={() => (dropdownOpen = false)}
                            ></div>
                        {/if}
                    </div>
                {:else}
                    <Button on:click={handleAuth} {disabled}>
                        {disabled ? "Connecting..." : "Login"}
                    </Button>
                {/if}

                <!-- Mobile Menu Button -->
                <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
                >
                    {#if mobileMenuOpen}
                        <svelte:component this={X} size={24} />
                    {:else}
                        <svelte:component this={Menu} size={24} />
                    {/if}
                </Button>
            </div>
        </div>

        <!-- Mobile Navigation -->
        {#if mobileMenuOpen}
            <nav class="md:hidden py-4 space-y-2 border-t border-border">
                {#each navItems as item}
                    {#if !item.authRequired || $isAuthenticated}
                        <Button
                            variant={currentPage === item.page
                                ? "default"
                                : "ghost"}
                            on:click={() => {
                                onNavigate(item.page);
                                mobileMenuOpen = false;
                            }}
                            className="w-full justify-start flex items-center gap-2"
                        >
                            {#if item.icon}
                                <svelte:component this={item.icon} size={16} />
                            {/if}
                            {item.label}
                        </Button>
                    {/if}
                {/each}
                {#if $isAdmin}
                    <Button
                        variant={currentPage === "admin" ? "default" : "ghost"}
                        on:click={() => {
                            onNavigate("admin");
                            mobileMenuOpen = false;
                        }}
                        className="w-full justify-start"
                    >
                        <Shield size={16} class="mr-2" />
                        Admin
                    </Button>
                {/if}
                {#if $isAuthenticated && $userProfile?.profile}
                    <div
                        class="flex items-center justify-center space-x-2 px-3 py-2 rounded-full bg-primary/10 text-primary font-semibold"
                    >
                        <span class="text-lg">Ꝟ</span>
                        <span
                            >{Number(
                                $userProfile.profile.balance,
                            ).toLocaleString()}</span
                        >
                    </div>
                {/if}
            </nav>
        {/if}
    </div>
</header>
