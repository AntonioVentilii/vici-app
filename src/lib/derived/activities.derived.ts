import { cachedListOrEmpty, cachedNotInitialized } from '$lib/derived/cached.derived';
import { globalActivitiesStore } from '$lib/stores/activities.store';
import type { Activity } from '$lib/types/social';
import type { Readable } from 'svelte/store';

export const globalActivities: Readable<Activity[]> = cachedListOrEmpty(globalActivitiesStore);

export const globalActivitiesNotInitialized: Readable<boolean> =
	cachedNotInitialized(globalActivitiesStore);
