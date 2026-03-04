import type { UserProfile } from '$lib/types/profile';
import type { UserOption } from '$lib/types/user';
import { writable } from 'svelte/store';

export interface UserStoreData {
	user: UserOption;
	profile: UserProfile | undefined;
}

export const userStore = writable<UserStoreData>({
	user: undefined,
	profile: undefined
});
