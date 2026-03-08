import type { UserProfile } from '$lib/types/profile';
import type { User } from '@junobuild/core';
import { writable } from 'svelte/store';

export interface UserStoreData {
	user: User | undefined;
	profile: UserProfile | undefined;
}

export const userStore = writable<UserStoreData>({
	user: undefined,
	profile: undefined
});
