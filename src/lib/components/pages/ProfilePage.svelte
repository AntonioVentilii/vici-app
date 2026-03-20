<script lang="ts">
	import AvatarSystem from '$lib/components/profile/AvatarSystem.svelte';
	import ProfileDashboard from '$lib/components/profile/ProfileDashboard.svelte';
	import ActivityFeed from '$lib/components/social/ActivityFeed.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { userStore } from '$lib/stores/user.store';
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
			<ProfileDashboard profile={$userStore.profile} />

			<!-- Customization & Settings Section -->
			<div class="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
				<AvatarSystem profile={$userStore.profile} />
			</div>

			<!-- Secondary Content: Activity -->
			<div class="space-y-8 pt-8">
				<h3 class="text-xl font-black text-slate-950">Recent Prediction Context</h3>
				<ActivityFeed mode="user" userPrincipal={$authPrincipal ?? ''} />
			</div>
		</div>
	{:else}
		<div
			class="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 py-24 text-center"
		>
			<div class="mb-6 rounded-full bg-white p-6 shadow-sm">
				<span class="text-4xl text-slate-300">👤</span>
			</div>
			<h2 class="text-2xl font-black text-slate-950">No Profile Found</h2>
			<p class="mt-2 max-w-xs text-slate-500">
				You need to sign in or place your first prediction to initialize your social identity.
			</p>
		</div>
	{/if}
</div>
