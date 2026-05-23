import {
	getFriendRequests,
	getFriends,
	getRejectedFriendships
} from '$lib/services/relation.services';
import { userStore } from '$lib/stores/user.store';
import type { Relation } from '$lib/types/relation';
import type { Doc } from '@junobuild/core';
import { derived, get, writable, type Readable } from 'svelte/store';

/**
 * Reactive cache of the viewer's social graph.
 *
 * Single source of truth shared by `FriendsList`, the Profile dashboard
 * entry, and the inbox so counts/badges and inline UI stay in sync after
 * accept/reject/unfriend mutations. The relation services themselves stay
 * stateless — callers run a mutation, then call `refreshFriendRelations()`
 * to repopulate these stores.
 */
export const friendsListStore = writable<Relation[]>([]);
export const friendRequestsStore = writable<Doc<Relation>[]>([]);
export const rejectedFriendshipsStore = writable<Doc<Relation>[]>([]);

/**
 * Flips to `true` the first time `refreshFriendRelations` completes for the
 * current principal, and stays `true` until `clearFriendRelations` runs (i.e.
 * the principal changes). Lets consumers show a spinner only on the cold
 * load and switch to stale-while-revalidate on every subsequent visit.
 */
export const friendsRelationsLoadedStore = writable<boolean>(false);

export const friendsCountStore: Readable<number> = derived(
	friendsListStore,
	($friends) => $friends.length
);

export const friendRequestsCountStore: Readable<number> = derived(
	friendRequestsStore,
	($requests) => $requests.length
);

const collectCounterparts = ({
	viewer,
	friends,
	requests,
	rejected
}: {
	viewer: string | undefined;
	friends: Relation[];
	requests: Doc<Relation>[];
	rejected: Doc<Relation>[];
}): string[] => {
	const targets = new Set<string>();

	const push = (relation: Relation) => {
		const other = relation.participants.find((p) => p !== viewer) ?? relation.participants[0];

		if (other) {
			targets.add(other);
		}
	};

	for (const relation of friends) {
		push(relation);
	}

	for (const doc of requests) {
		push(doc.data);
	}

	for (const doc of rejected) {
		push(doc.data);
	}

	return [...targets];
};

let inFlight: Promise<void> | undefined;

const runRefresh = async (): Promise<void> => {
	try {
		const [friends, requests, rejected] = await Promise.all([
			getFriends().catch(() => []),
			getFriendRequests().catch(() => []),
			getRejectedFriendships().catch(() => [])
		]);

		friendsListStore.set(friends);
		friendRequestsStore.set(requests);
		rejectedFriendshipsStore.set(rejected);
		friendsRelationsLoadedStore.set(true);

		// Hydrate the shared `profilesStore` for every counterpart of the
		// viewer. Lazy import avoids a circular reference between
		// profile.services → friends.store → profile.services.
		const { loadProfilesByPrincipals } = await import('$lib/services/profile.services');
		const viewer = get(userStore).user?.owner;
		const principals = collectCounterparts({ viewer, friends, requests, rejected });
		await loadProfilesByPrincipals({ principals });
	} finally {
		inFlight = undefined;
	}
};

/**
 * Refetches friends, incoming requests and rejected relations in parallel.
 * Concurrent callers share the same in-flight promise so a single render
 * pass mounting two consumers doesn't trigger duplicate network calls.
 */
export const refreshFriendRelations = (): Promise<void> => {
	inFlight ??= runRefresh();

	return inFlight;
};

export const clearFriendRelations = (): void => {
	friendsListStore.set([]);
	friendRequestsStore.set([]);
	rejectedFriendshipsStore.set([]);
	friendsRelationsLoadedStore.set(false);
};
