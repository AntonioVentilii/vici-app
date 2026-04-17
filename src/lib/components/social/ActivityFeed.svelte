<script lang="ts">
	import { onMount } from 'svelte';
	import ActivityItem from '$lib/components/social/ActivityItem.svelte';
	import BaseButton from '$lib/components/ui/BaseButton.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { getFriendActivities, getGlobalActivities } from '$lib/services/activity.services';
	import { getProfile } from '$lib/services/profile.services';
	import { getFollowing } from '$lib/services/relation.services';
	import type { UserProfile } from '$lib/types/profile';
	import type { Activity } from '$lib/types/social';

	interface Props {
		userPrincipal?: string;
		mode?: 'global' | 'friends' | 'user';
	}

	const { userPrincipal, mode = 'global' }: Props = $props();

	let activities = $state<Activity[]>([]);

	const profiles = $state<Map<string, UserProfile>>(new Map());

	let loading = $state(true);
	let refreshing = $state(false);

	onMount(async () => {
		await loadActivities();
	});

	const handleRefresh = async () => {
		refreshing = true;

		try {
			await loadActivities();
		} finally {
			refreshing = false;
		}
	};

	const loadActivities = async () => {
		loading = true;

		try {
			if (mode === 'friends' && userPrincipal) {
				const following = await getFollowing();
				activities = await getFriendActivities({ friends: following });
			} else if (mode === 'user' && userPrincipal) {
				// For now, we reuse global and filter, but ideally we'd have a specific API
				const all = await getGlobalActivities();
				activities = all.filter((a) => a.user === userPrincipal);
			} else {
				activities = await getGlobalActivities();
			}

			for (const activity of activities) {
				const usersToFetch = [activity.user, activity.targetUser].filter(Boolean) as string[];

				for (const u of usersToFetch) {
					if (!profiles.has(u)) {
						const profileDoc = await getProfile(u);

						if (profileDoc) {
							profiles.set(u, profileDoc.data);
						}
					}
				}
			}
		} finally {
			loading = false;
		}
	};
</script>

<Card padding="lg" variant="glass">
	<div class="flex w-full flex-col gap-4">
		<div class="flex w-full items-center justify-between">
			<h3 class="text-primary text-xl font-bold">
				{mode === 'friends' ? 'Friend Activity' : 'Recent Activity'}
			</h3>
			<BaseButton
				class="text-primary hover:text-primary/80 text-xs font-medium transition-colors"
				onclick={handleRefresh}
				status={refreshing ? 'pending' : 'enabled'}
			>
				Refresh
			</BaseButton>
		</div>

		<div class="custom-scrollbar flex max-h-120 flex-col gap-4 overflow-y-auto pr-2">
			{#if loading}
				<div class="flex justify-center py-8">
					<LoadingSpinner />
				</div>
			{:else if activities.length === 0}
				<p class="text-muted-foreground py-12 text-center text-sm italic opacity-50">
					No activity found.
				</p>
			{:else}
				{#each activities as activity (activity.timestamp + activity.user)}
					{@const profile = profiles.get(activity.user)}

					<ActivityItem {activity} {profile} />
				{/each}
			{/if}
		</div>
	</div>
</Card>

<style lang="postcss">
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(var(--primary-rgb), 0.2);
		border-radius: 10px;
	}
</style>
