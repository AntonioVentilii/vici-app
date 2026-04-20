import type { UserProfile } from '$lib/types/profile';
import type { User } from '@junobuild/core';
import { writable } from 'svelte/store';

export interface UserStoreData {
	user: User | undefined;
	profile: UserProfile | undefined;
	/**
	 * True while we are resolving the authentication state (initial session
	 * check on load, sign-in in progress, sign-out in progress, or profile
	 * hydration). Consumers should treat this as "we don't know yet" and
	 * avoid rendering signed-out UI.
	 */
	authBusy: boolean;
}

export const userStore = writable<UserStoreData>({
	user: undefined,
	profile: undefined,
	authBusy: true
});

/**
 * Flag the auth state as being resolved. Use this right before triggering
 * a sign-in / sign-out so that the UI does not flash the wrong state
 * between the action and the `onAuthStateChange` callback firing.
 */
export const setAuthBusy = (authBusy: boolean): void => {
	userStore.update((data) => ({ ...data, authBusy }));
};
