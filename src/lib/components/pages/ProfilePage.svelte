<script lang="ts">
	import ActivityFeed from '$lib/components/social/ActivityFeed.svelte';
	import ProfileCard from '$lib/components/social/ProfileCard.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { authPrincipal } from '$lib/derived/user.derived';
	import { userStore } from '$lib/stores/user.store';
</script>

<div class="space-y-8">
	<SectionHeader
		description="View and manage your public profile and trading history."
		highlight="Profile"
		title="User"
	/>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
		<div class="lg:col-span-1">
			{#if $userStore.profile}
				<ProfileCard profile={$userStore.profile} viewerPrincipal={$authPrincipal ?? ''} />
			{:else}
				<div class="rounded-xl border border-slate-200 bg-white p-8 text-center">
					<p class="text-slate-500">No profile found. Start trading to create one!</p>
				</div>
			{/if}
		</div>
		<div class="lg:col-span-2">
			<ActivityFeed mode="user" userPrincipal={$authPrincipal ?? ''} />
		</div>
	</div>
</div>
