<script lang="ts">
    import { onMount } from "svelte";
    import { friends } from "../stores/friends";
    import Avatar from "./ui/Avatar.svelte";
    import Button from "./ui/Button.svelte";
    import { UserMinus } from "lucide-svelte";
    import type { Principal } from "@icp-sdk/core/principal";
    import type { UserProfile } from "../backend";

    export let friend: Principal;
    export let onRemove: (friend: Principal) => void;
    export let isRemoving: boolean = false;

    let profile: UserProfile | null = null;
    let isLoading = true;

    onMount(async () => {
        profile = await friends.getProfile(friend);
        isLoading = false;
    });
</script>

<div class="flex items-center justify-between p-3 bg-slate-100/50 rounded-md">
    <div class="flex items-center gap-3">
        <Avatar
            className="h-10 w-10"
            fallback={profile?.nickname?.[0]?.toUpperCase() || "U"}
        />
        <div>
            {#if isLoading}
                <div
                    class="h-4 w-24 bg-slate-200 animate-pulse rounded mb-1"
                ></div>
                <div class="h-3 w-32 bg-slate-200 animate-pulse rounded"></div>
            {:else}
                <p class="text-sm font-medium text-foreground">
                    {profile?.nickname || "Unknown user"}
                </p>
                <p
                    class="text-xs text-muted-foreground font-mono truncate max-w-[200px]"
                >
                    {friend.toString()}
                </p>
            {/if}
        </div>
    </div>
    <Button
        variant="ghost"
        size="sm"
        on:click={() => onRemove(friend)}
        disabled={isRemoving}
    >
        <UserMinus size={16} />
    </Button>
</div>
