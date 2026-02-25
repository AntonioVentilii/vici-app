import { writable, derived, get } from 'svelte/store';
import { backend } from './actor';
import type { UserProfile } from '../backend';

function createProfileStore() {
	const { subscribe, set, update } = writable<{
		profile: UserProfile | null;
		isAdmin: boolean;
		isLoading: boolean;
		isFetched: boolean;
	}>({
		profile: null,
		isAdmin: false,
		isLoading: false,
		isFetched: false
	});

	async function fetchProfile() {
		const { actor } = get(backend);
		if (!actor) return;

		update((s) => ({ ...s, isLoading: true }));
		try {
			const [profile, isAdmin] = await Promise.all([
				actor.getCallerUserProfile(),
				actor.isCallerAdmin()
			]);
			set({
				profile,
				isAdmin,
				isLoading: false,
				isFetched: true
			});
		} catch (error) {
			console.error('Failed to fetch profile:', error);
			update((s) => ({ ...s, isLoading: false, isFetched: true }));
		}
	}

	// Refresh when backend actor changes
	backend.subscribe(({ actor }) => {
		if (actor) {
			fetchProfile();
		} else {
			set({ profile: null, isAdmin: false, isLoading: false, isFetched: false });
		}
	});

	async function updateProfile(newProfile: UserProfile) {
		const { actor } = get(backend);
		if (!actor) throw new Error('Actor not available');

		update((s) => ({ ...s, isLoading: true }));
		try {
			await actor.saveCallerUserProfile(newProfile);
			update((s) => ({ ...s, profile: newProfile, isLoading: false }));
		} catch (error) {
			console.error('Failed to update profile:', error);
			update((s) => ({ ...s, isLoading: false }));
			throw error;
		}
	}

	return {
		subscribe,
		refresh: fetchProfile,
		updateProfile
	};
}

export const userProfile = createProfileStore();
export const isAdmin = derived(userProfile, ($s) => $s.isAdmin);
export const profileLoading = derived(userProfile, ($s) => $s.isLoading);
export const profileFetched = derived(userProfile, ($s) => $s.isFetched);
