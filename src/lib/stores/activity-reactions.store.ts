import { writable } from 'svelte/store';

/**
 * Per-activity reaction tally: how many users liked the activity, and whether the current viewer is
 * one of them. Keyed by the activity's doc key (`${user}#${timestamp}#${type}`).
 */
export interface ActivityReactionSummary {
	count: number;
	mineLiked: boolean;
}

/**
 * Count-on-read reaction summaries for the friend feed, keyed by activity doc key. Populated by
 * `LoaderGlobalActivities` (one bounded read alongside the activities fetch) and consumed by
 * `FriendsTab`. `undefined` distinguishes "not yet loaded" from "loaded but no reactions".
 */
export const activityReactionsStore = writable<Map<string, ActivityReactionSummary> | undefined>(
	undefined
);
