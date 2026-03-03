import type { UserOption, UserProfile } from '$lib/types/user';
import { writable } from 'svelte/store';

export interface UserStoreData {
	user: UserOption;
	profile: UserProfile | undefined;
}

export const userStore = writable<UserStoreData>({
	user: undefined,
	profile: undefined
});
