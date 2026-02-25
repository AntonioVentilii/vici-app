import { writable, get } from 'svelte/store';
import { backend } from './actor';
import type { UserProfile } from '../backend';
import type { Principal } from '@icp-sdk/core/principal';

function createFriendsStore() {
	const { subscribe, set, update } = writable<{
		friends: Principal[];
		profiles: Record<string, UserProfile>;
		isLoading: boolean;
		isFetched: boolean;
	}>({
		friends: [],
		profiles: {},
		isLoading: false,
		isFetched: false
	});

	async function fetchFriends() {
		const { actor } = get(backend);
		if (!actor) return;

		update((s) => ({ ...s, isLoading: true }));
		try {
			const friends = await actor.getFriends();
			update((s) => ({ ...s, friends: friends || [], isLoading: false, isFetched: true }));
		} catch (error) {
			console.error('Failed to fetch friends:', error);
			update((s) => ({ ...s, isLoading: false, isFetched: true }));
		}
	}

	async function getProfile(principal: Principal) {
		const principalStr = principal.toString();
		const current = get({ subscribe });
		if (current.profiles[principalStr]) return current.profiles[principalStr];

		const { actor } = get(backend);
		if (!actor) return null;

		try {
			const profile = await actor.getUserProfile(principal);
			if (profile) {
				update((s) => ({
					...s,
					profiles: { ...s.profiles, [principalStr]: profile }
				}));
			}
			return profile;
		} catch (error) {
			console.error(`Failed to fetch profile for ${principalStr}:`, error);
			return null;
		}
	}

	async function addFriend(principal: Principal) {
		const { actor } = get(backend);
		if (!actor) throw new Error('Actor not available');

		await actor.addFriend(principal);
		await fetchFriends();
	}

	async function removeFriend(principal: Principal) {
		const { actor } = get(backend);
		if (!actor) throw new Error('Actor not available');

		await actor.removeFriend(principal);
		await fetchFriends();
	}

	backend.subscribe(({ actor }) => {
		if (actor) {
			fetchFriends();
		} else {
			set({ friends: [], profiles: {}, isLoading: false, isFetched: false });
		}
	});

	return {
		subscribe,
		getProfile,
		addFriend,
		removeFriend,
		refresh: fetchFriends
	};
}

export const friends = createFriendsStore();
