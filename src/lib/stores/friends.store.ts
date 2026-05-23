import { getProfile } from '$lib/services/profile.services';
import {
	getFriendRequests,
	getFriends,
	getRejectedFriendships
} from '$lib/services/relation.services';
import { userStore } from '$lib/stores/user.store';
import type { UserProfile } from '$lib/types/profile';
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
 * Cache of `principal → UserProfile` for every counterpart the viewer has
 * a relation with (friends, incoming requests, rejected). Populated as a
 * side-effect of `refreshFriendRelations` so any consumer (Friends list,
 * inbox card, future avatars on the dashboard) can read names/avatars
 * without re-hitting the satellite.
 */
export const friendProfilesStore = writable<Map<string, UserProfile>>(new Map());

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

		const viewer = get(userStore).user?.owner;
		const cached = get(friendProfilesStore);
		const missing = collectCounterparts({ viewer, friends, requests, rejected }).filter(
			(principal) => !cached.has(principal)
		);

		if (missing.length > 0) {
			const docs = await Promise.all(
				missing.map((principal) => getProfile(principal).catch(() => undefined))
			);

			friendProfilesStore.update((current) => {
				const next = new Map(current);

				for (let i = 0; i < missing.length; i++) {
					const doc = docs[i];

					if (doc) {
						next.set(missing[i], doc.data);
					}
				}

				return next;
			});
		}
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
	friendProfilesStore.set(new Map());
};
