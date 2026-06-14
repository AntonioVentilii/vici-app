import type { ActivityReaction } from '$lib/types/social';
import { writable } from 'svelte/store';

/**
 * Count-on-read reaction docs for the friend feed — the most-recent page across all users,
 * populated by `LoaderGlobalActivities`. Consumers derive per-activity counts **and** the viewer's
 * own likes from this raw list, keeping the viewer reactive (`$authPrincipal`) so persisted likes
 * highlight as soon as auth resolves rather than only after a manual refresh. `undefined`
 * distinguishes "not yet loaded" from "loaded but no reactions".
 */
export const activityReactionsStore = writable<ActivityReaction[] | undefined>(undefined);
