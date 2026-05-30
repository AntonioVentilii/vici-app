<script lang="ts">
	import CachedLoader from '$lib/components/loaders/CachedLoader.svelte';
	import { VICI_EVENTS } from '$lib/constants/events.constants';
	import { getGlobalActivities } from '$lib/services/activity.services';
	import { loadProfilesByPrincipals } from '$lib/services/profile.services';
	import { globalActivitiesStore } from '$lib/stores/activities.store';

	const GLOBAL_ACTIVITIES_LIMIT = 50;

	// Hydrate the shared `profilesStore` as a side-effect so consumers
	// (ActivityFeed, MarketRecentTrades) can render names/avatars without
	// each running their own profile-fetch loop.
	const onLoad = async () => {
		const activities = await getGlobalActivities({ limit: GLOBAL_ACTIVITIES_LIMIT });

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
