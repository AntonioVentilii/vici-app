import { ROLE_PERMISSIONS } from '$lib/constants/authz.constants';
import { userStore } from '$lib/stores/user.store';
import type { Permission } from '$lib/types/permission';
import type { UserRole } from '$lib/types/user';
import { nonNullish } from '@dfinity/utils';
import { derived, type Readable } from 'svelte/store';

export const userSignedIn: Readable<boolean> = derived(userStore, ({ user }) => nonNullish(user));

export const userNotSignedIn: Readable<boolean> = derived(userSignedIn, (signedIn) => !signedIn);

export const userRole: Readable<UserRole | undefined> = derived(
	userStore,
	({ profile }) => profile?.role
);

export const userPermissions: Readable<Permission[]> = derived(userRole, ($role) =>
	$role ? ROLE_PERMISSIONS[$role] : []
);
