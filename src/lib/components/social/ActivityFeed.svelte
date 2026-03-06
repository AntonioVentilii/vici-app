<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { getFriendActivities, getGlobalActivities } from '$lib/services/activity.services';
	import { getProfile } from '$lib/services/profile.services';
	import { getFollowing } from '$lib/services/relation.services';
	import type { UserProfile } from '$lib/types/profile';
	import { ActivityType, type Activity } from '$lib/types/social';

	interface Props {
		userPrincipal?: string;
		mode?: 'global' | 'friends' | 'user';
	}

	const { userPrincipal, mode = 'global' }: Props = $props();

	let activities = $state<Activity[]>([]);

	const profiles = $state<Map<string, UserProfile>>(new Map());

	let loading = $state(true);

	onMount(async () => {
		await loadActivities();
	});

	const loadActivities = async () => {
		loading = true;
		try {
			if (mode === 'friends' && userPrincipal) {
				const following = await getFollowing(userPrincipal);
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
						const profile = await getProfile(u);
						if (profile) {
							profiles.set(u, profile);
						}
					}
				}
			}
		} finally {
			loading = false;
		}
	};

	const getActivityIcon = (type: ActivityType) => {
		switch (type) {
			case ActivityType.TRADE:
				return '📈';
			case ActivityType.SETTLEMENT:
				return '🏁';
			case ActivityType.COMMENT:
				return '💬';
			case ActivityType.FOLLOW:
				return '👤';
			default:
				return '📍';
		}
	};
</script>

<Card class="flex flex-col gap-4 p-6" glassStyle>
	<div class="flex items-center justify-between">
		<h3
			class="from-primary to-secondary bg-linear-to-r bg-clip-text text-xl font-bold text-transparent"
		>
			{mode === 'friends' ? 'Friend Activity' : 'Recent Activity'}
		</h3>
		<button
			class="text-primary hover:text-primary/80 text-xs font-medium transition-colors"
			onclick={loadActivities}
		>
			Refresh
		</button>
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
				<div
					class="group relative flex gap-3 rounded-2xl bg-white/5 p-3 transition-all hover:bg-white/10"
				>
					<div class="text-xl">{getActivityIcon(activity.type)}</div>
					<div class="flex-1 overflow-hidden">
						<div class="flex items-center justify-between gap-2">
							<p class="group-hover:text-primary truncate text-sm font-semibold transition-colors">
								{profile?.nickname ?? 'Anonymous'}
							</p>
							<span class="text-muted-foreground shrink-0 text-[10px] opacity-50">
								{new Date(activity.timestamp).toLocaleTimeString([], {
									hour: '2-digit',
									minute: '2-digit'
								})}
							</span>
						</div>
						<p class="text-foreground/80 mb-1 text-xs font-medium">{activity.title}</p>
						{#if activity.details}
							<p class="text-muted-foreground line-clamp-2 text-[11px] italic opacity-70">
								"{activity.details}"
							</p>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
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
