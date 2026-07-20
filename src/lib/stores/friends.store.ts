import type * as ProfileServices from '$lib/services/profile.services';
import type * as RelationQueries from '$lib/services/relation-queries.services';
import { userStore } from '$lib/stores/user.store';
import type { Relation } from '$lib/types/relation';
import type { Doc } from '@junobuild/core';
import { get, writable } from 'svelte/store';

/**
 * Reactive cache of the viewer's social graph.
 *
 * Single source of truth shared by `FriendsTab`, the Profile dashboard
 * entry, and the inbox so counts/badges and inline UI stay in sync after
 * accept/reject/unfriend mutations. The relation services themselves stay
 * stateless — callers run a mutation, then call `refreshFriendRelations()`
 * to repopulate these stores.
 */
export const friendsListStore = writable<Relation[]>([]);
export const friendRequestsStore = writable<Doc<Relation>[]>([]);
export const sentFriendRequestsStore = writable<Doc<Relation>[]>([]);

/**
 * Flips to `true` the first time `refreshFriendRelations` completes for the
 * current principal, and stays `true` until `clearFriendRelations` runs (i.e.
 * the principal changes). Lets consumers show a spinner only on the cold
 * load and switch to stale-while-revalidate on every subsequent visit.
 */
export const friendsRelationsLoadedStore = writable<boolean>(false);

const collectCounterparts = ({
	viewer,
	friends,
	requests,
	sent
}: {
	viewer: string | undefined;
	friends: Relation[];
	requests: Doc<Relation>[];
	sent: Doc<Relation>[];
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

	for (const doc of sent) {
		push(doc.data);
	}

	return [...targets];
};

let inFlight: Promise<void> | undefined;
let queued = false;

const runRefresh = async (): Promise<void> => {
	// Services load on demand: this store sits in the auth boot graph
	// (`Authn` imports `clearFriendRelations`), and a static service import
	// would drag the satellite API + zod cluster into every first paint.
	// Fails open on a chunk-load failure (log + keep the current cache):
	// callers fire `void refreshFriendRelations()`, so a rejection here
	// would surface as an unhandled rejection instead of a retryable miss.
	let services: [typeof RelationQueries, typeof ProfileServices];

	try {
		services = await Promise.all([
			import('$lib/services/relation-queries.services'),
			import('$lib/services/profile.services')
		]);
	} catch (err: unknown) {
		console.warn('friends.store: services failed to load', err);

		return;
	}

	const [{ getFriendRequests, getFriends, getSentFriendRequests }, { loadProfilesByPrincipals }] =
		services;

	const [friends, requests, sent] = await Promise.all([
		getFriends().catch(() => []),
		getFriendRequests().catch(() => []),
		getSentFriendRequests().catch(() => [])
	]);

	friendsListStore.set(friends);
	friendRequestsStore.set(requests);
	sentFriendRequestsStore.set(sent);
	friendsRelationsLoadedStore.set(true);

	// Hydrate the shared `profilesStore` for every counterpart of the
	// viewer. Fire-and-forget so the refresh promise resolves as soon as the
	// relation lists are in the stores — keeping `inFlight` open while
	// profiles trickle in would otherwise let a post-mutation
	// `refreshFriendRelations()` reuse the pre-mutation fetch (stale data)
	// instead of issuing a new one.
	const viewer = get(userStore).user?.owner;
	const principals = collectCounterparts({ viewer, friends, requests, sent });
	void loadProfilesByPrincipals({ principals });
};

const schedule = (): Promise<void> => {
	const current = runRefresh().finally(() => {
		inFlight = undefined;

		if (queued) {
			queued = false;
			schedule();
		}
	});
	inFlight = current;

	return current;
};

/**
 * Refetches friends, incoming requests and sent requests in parallel.
 *
 * Concurrency contract:
 * - Same-tick concurrent callers (e.g. two consumers mounting together)
 *   share the in-flight promise so we don't issue duplicate query calls.
 * - A call that arrives **while** a refresh is in flight (typically a
 *   post-mutation refresh from `handleAccept` / `handleReject` /
 *   `handleCancel` / `handleUnfriend`) guarantees one additional fetch
 *   after the current one finishes, so the caller observes state that
 *   reflects its mutation. Without this, a background refresh kicked off
 *   by `onMount` could swallow the post-mutation refresh and leave the
 *   just-accepted request visibly stuck in the list.
 */
export const refreshFriendRelations = async (): Promise<void> => {
	if (inFlight) {
		queued = true;
		await inFlight;

		// `schedule()` reassigns `inFlight` to the follow-up run if one
		// was queued. Await it so the caller sees the post-mutation data.
		if (inFlight) {
			await inFlight;
		}

		return;
	}

	await schedule();
};

export const clearFriendRelations = (): void => {
	friendsListStore.set([]);
	friendRequestsStore.set([]);
	sentFriendRequestsStore.set([]);
	friendsRelationsLoadedStore.set(false);
};
