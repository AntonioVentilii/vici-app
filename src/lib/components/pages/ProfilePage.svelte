<script lang="ts">
	import { onMount } from 'svelte';
	import AvatarSystem from '$lib/components/profile/AvatarSystem.svelte';
	import ProfileDashboard from '$lib/components/profile/ProfileDashboard.svelte';
	import ActivityFeed from '$lib/components/social/ActivityFeed.svelte';
	import FriendsList from '$lib/components/social/FriendsList.svelte';
	import GroupManager from '$lib/components/social/GroupManager.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { getProfile } from '$lib/services/profile.services';
	import { userStore } from '$lib/stores/user.store';

	let intervalId: ReturnType<typeof setInterval> | undefined;

	onMount(() => {
		const refreshProfile = async () => {
			if ($authPrincipal) {
				const profileDoc = await getProfile($authPrincipal);
				userStore.update((s) => ({ ...s, profile: profileDoc.data }));
			}
		};

		intervalId = setInterval(refreshProfile, 60000);

		return () => clearInterval(intervalId);
	});
</script>

<div class="space-y-12 pb-24">
	<SectionHeader
		description="Track your performance, fire streaks, and global accuracy."
		highlight="Identity"
		title="Social"
	/>

	{#if $userStore.profile}
		<div class="space-y-12">
			<!-- Main Dashboard -->
			<ProfileDashboard profile={$userStore.profile} viewerPrincipal={$authPrincipal ?? ''} />

			<!-- Customization & Settings Section -->
			<div class="border-border bg-card rounded-lg border p-8">
				<AvatarSystem profile={$userStore.profile} />
			</div>

			<!-- Social Connections Section -->
			<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
				<FriendsList userPrincipal={$authPrincipal ?? ''} />
				<GroupManager userPrincipal={$authPrincipal ?? ''} />
			</div>

			<!-- Secondary Content: Activity -->
			<div class="space-y-8 pt-8">
				<ActivityFeed mode="user" userPrincipal={$authPrincipal ?? ''} />
			</div>
		</div>
	{:else}
		<div
			class="border-border bg-card flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-24 text-center"
		>
			<div class="bg-card mb-6 rounded-full p-6">
				<span class="text-muted-foreground text-4xl">👤</span>
			</div>
			<h2 class="font-display text-foreground text-2xl font-semibold">No Profile Found</h2>
			<p class="text-muted-foreground mt-2 max-w-xs">
				You need to sign in or place your first prediction to initialize your social identity.
			</p>
		</div>
	{/if}
</div>
