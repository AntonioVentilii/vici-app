<script lang="ts">
	import CachedLoader from '$lib/components/loaders/CachedLoader.svelte';
	import { VICI_EVENTS } from '$lib/constants/events.constants';
	import { getActivityReactions } from '$lib/services/activity-reaction.services';
	import { getGlobalActivities } from '$lib/services/activity.services';
	import { loadProfilesByPrincipals } from '$lib/services/profile.services';
	import { globalActivitiesStore } from '$lib/stores/activities.store';
	import { activityReactionsStore } from '$lib/stores/activity-reactions.store';

	const GLOBAL_ACTIVITIES_LIMIT = 50;

	// Hydrate the shared `profilesStore` and the friend-feed reactions as
	// side-effects so consumers (ActivityFeed, MarketRecentTrades,
	// FriendsTab) render names/avatars/like-counts without each running
	// their own fetch loop. The raw reaction page is stored as-is; counts +
	// the viewer's own likes are derived (reactively) at the consumer, so
	// they're viewer-agnostic here and survive a signed-out load.
	const onLoad = async () => {
		const [activities, reactions] = await Promise.all([
			getGlobalActivities({ limit: GLOBAL_ACTIVITIES_LIMIT }),
			getActivityReactions()
		]);

		activityReactionsStore.set(reactions);

		const principals = activities.flatMap((a) =>
			[a.user, a.targetUser].filter((p): p is string => typeof p === 'string' && p.length > 0)
		);

		await loadProfilesByPrincipals({ principals });

		return activities;
	};
</script>

<CachedLoader
	{onLoad}
	refreshEvent={VICI_EVENTS.REFRESH_GLOBAL_ACTIVITIES}
	requireIdentity={false}
	store={globalActivitiesStore}
/>
