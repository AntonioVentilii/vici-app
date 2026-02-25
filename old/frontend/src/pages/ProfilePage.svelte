<script lang="ts">
    import { userProfile } from "../stores/profile";
    import { friends } from "../stores/friends";
    import Card from "../components/ui/Card.svelte";
    import Button from "../components/ui/Button.svelte";
    import Input from "../components/ui/Input.svelte";
    import Avatar from "../components/ui/Avatar.svelte";
    import FriendListItem from "../components/FriendListItem.svelte";
    import { User, Save, UserPlus, Users, Loader2 } from "lucide-svelte";
    import { Principal } from "@icp-sdk/core/principal";
    import { toast } from "sonner";

    let nickname = "";
    let isEditing = false;
    let friendPrincipal = "";
    let isSaving = false;
    let isAddingFriend = false;

    $: profile = $userProfile.profile;
    $: isLoading = $userProfile.isLoading;
    $: friendsList = $friends.friends;

    const handleSave = async () => {
        if (!profile || !nickname.trim()) {
            toast.error("Please enter a valid nickname");
            return;
        }

        isSaving = true;
        try {
            await userProfile.updateProfile({
                ...profile,
                nickname: nickname.trim(),
            });
            toast.success("Profile updated successfully");
            isEditing = false;
        } catch (error) {
            toast.error("Failed to update profile");
            console.error(error);
        } finally {
            isSaving = false;
        }
    };

    const handleAddFriend = async () => {
        if (!friendPrincipal.trim()) {
            toast.error("Please enter a valid Principal ID");
            return;
        }

        isAddingFriend = true;
        try {
            const principal = Principal.fromText(friendPrincipal.trim());
            await friends.addFriend(principal);
            toast.success("Friend added successfully");
            friendPrincipal = "";
        } catch (error: any) {
            const msg = error.message || "";
            if (msg.includes("Cannot add yourself")) {
                toast.error("Cannot add yourself as a friend");
            } else if (msg.includes("Already friends")) {
                toast.error("Already friends with this user");
            } else if (msg.includes("User does not exist")) {
                toast.error("User does not exist");
            } else if (msg.includes("Invalid principal")) {
                toast.error("Invalid Principal ID format");
            } else {
                toast.error("Failed to add friend");
            }
            console.error(error);
        } finally {
            isAddingFriend = false;
        }
    };

    const handleRemoveFriend = async (friend: Principal) => {
        try {
            await friends.removeFriend(friend);
            toast.success("Friend removed successfully");
        } catch (error: any) {
            toast.error("Failed to remove friend");
            console.error(error);
        }
    };

    const formatDate = (timestamp: bigint) => {
        const date = new Date(Number(timestamp) / 1000000);
        return date.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    };
</script>

<div class="container mx-auto px-4 py-8 max-w-2xl">
    <div class="space-y-8">
        <!-- Header -->
        <div>
            <h1 class="text-4xl font-bold text-foreground">Profile Settings</h1>
            <p class="text-muted-foreground mt-2">
                Manage your account information
            </p>
        </div>

        {#if isLoading && !profile}
            <Card>
                <div class="p-12 flex justify-center">
                    <Loader2 class="animate-spin text-primary" size={32} />
                </div>
            </Card>
        {:else if !profile}
            <div class="text-center py-16">
                <p class="text-muted-foreground">Profile not found</p>
            </div>
        {:else}
            <!-- Profile Card -->
            <Card>
                <div class="p-6 space-y-6">
                    <h3 class="text-lg font-semibold">Account Information</h3>

                    <div class="flex items-center gap-6">
                        <Avatar
                            className="h-24 w-24"
                            fallback={profile.nickname[0]?.toUpperCase() || "U"}
                        />
                        <div class="space-y-1">
                            <h3 class="text-xl font-semibold text-foreground">
                                {profile.nickname}
                            </h3>
                            <p class="text-sm text-muted-foreground">
                                Member since {formatDate(profile.createdAt)}
                            </p>
                        </div>
                    </div>

                    <div class="space-y-4 pt-4 border-t border-border">
                        <div class="space-y-2">
                            <label for="nickname" class="text-sm font-medium"
                                >Nickname</label
                            >
                            {#if isEditing}
                                <Input
                                    id="nickname"
                                    bind:value={nickname}
                                    placeholder={profile.nickname}
                                />
                            {:else}
                                <div
                                    class="flex items-center justify-between p-3 bg-slate-50 rounded-md"
                                >
                                    <span class="text-foreground"
                                        >{profile.nickname}</span
                                    >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        on:click={() => {
                                            nickname = profile?.nickname || "";
                                            isEditing = true;
                                        }}
                                    >
                                        <User size={16} class="mr-2" />
                                        Edit
                                    </Button>
                                </div>
                            {/if}
                        </div>

                        {#if isEditing}
                            <div class="flex gap-2">
                                <Button
                                    on:click={handleSave}
                                    disabled={isSaving}
                                >
                                    {#if isSaving}
                                        <Loader2
                                            size={16}
                                            class="mr-2 animate-spin"
                                        />
                                        Saving...
                                    {:else}
                                        <Save size={16} class="mr-2" />
                                        Save Changes
                                    {/if}
                                </Button>
                                <Button
                                    variant="outline"
                                    on:click={() => {
                                        isEditing = false;
                                        nickname = "";
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        {/if}
                    </div>
                </div>
            </Card>

            <!-- Stats Card -->
            <Card>
                <div class="p-6">
                    <h3 class="text-lg font-semibold mb-4">Account Stats</h3>
                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-1">
                            <p class="text-sm text-muted-foreground">
                                Current Balance
                            </p>
                            <p class="text-2xl font-bold text-foreground">
                                Ꝟ {Number(profile.balance).toLocaleString()}
                            </p>
                            <p class="text-xs text-muted-foreground">
                                Vici Coins
                            </p>
                        </div>
                        <div class="space-y-1">
                            <p class="text-sm text-muted-foreground">
                                Last Login
                            </p>
                            <p class="text-lg font-semibold text-foreground">
                                {formatDate(profile.lastLogin)}
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            <!-- Friends Card -->
            <Card>
                <div class="p-6 space-y-6">
                    <h3 class="text-lg font-semibold flex items-center gap-2">
                        <Users size={20} />
                        Friends
                    </h3>

                    <div class="space-y-2">
                        <label for="friendPrincipal" class="text-sm font-medium"
                            >Add Friend by Principal ID</label
                        >
                        <div class="flex gap-2">
                            <Input
                                id="friendPrincipal"
                                bind:value={friendPrincipal}
                                placeholder="xxxxx-xxxxx-xxxxx-xxxxx-xxx"
                                className="flex-1"
                            />
                            <Button
                                on:click={handleAddFriend}
                                disabled={isAddingFriend ||
                                    !friendPrincipal.trim()}
                            >
                                {#if isAddingFriend}
                                    <Loader2
                                        size={16}
                                        class="mr-2 animate-spin"
                                    />
                                    Adding...
                                {:else}
                                    <UserPlus size={16} class="mr-2" />
                                    Add
                                {/if}
                            </Button>
                        </div>
                        <p class="text-xs text-muted-foreground">
                            Enter the Principal ID of the user you want to add
                            as a friend
                        </p>
                    </div>

                    <hr class="border-border" />

                    <div class="space-y-3">
                        <h4 class="text-sm font-medium text-foreground">
                            Your Friends ({friendsList.length})
                        </h4>
                        {#if friendsList.length > 0}
                            <div class="space-y-2">
                                {#each friendsList as friend}
                                    <FriendListItem
                                        {friend}
                                        onRemove={handleRemoveFriend}
                                    />
                                {/each}
                            </div>
                        {:else}
                            <div class="text-center py-8 text-muted-foreground">
                                <Users
                                    size={48}
                                    class="mx-auto mb-2 opacity-50"
                                />
                                <p class="text-sm">No friends yet</p>
                                <p class="text-xs mt-1">
                                    Add friends to invite them to private
                                    markets
                                </p>
                            </div>
                        {/if}
                    </div>
                </div>
            </Card>
        {/if}
    </div>
</div>
