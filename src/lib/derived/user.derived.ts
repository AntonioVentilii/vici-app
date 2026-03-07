import { ROLE_PERMISSIONS } from '$lib/constants/authz.constants';
import { userStore } from '$lib/stores/user.store';
import type { Permission } from '$lib/types/permission';
import { UserRole } from '$lib/types/user';
import { nonNullish } from '@dfinity/utils';
import { derived, type Readable } from 'svelte/store';

export const userSignedIn: Readable<boolean> = derived(userStore, ({ user }) => nonNullish(user));

export const userNotSignedIn: Readable<boolean> = derived(userSignedIn, (signedIn) => !signedIn);

export const userRole: Readable<UserRole | undefined> = derived(
	userStore,
	({ profile }) => profile?.role
);

export const authPrincipal: Readable<string | undefined> = derived(
	userStore,
	({ user }) => user?.owner
);

export const userIsAdmin: Readable<boolean> = derived(
	userRole,
	($userRole) => $userRole === UserRole.ADMIN
);

export const userIsAdminOrResolver: Readable<boolean> = derived(
	userRole,
	($userRole) => $userRole === UserRole.ADMIN || $userRole === UserRole.RESOLVER
);

export const userPermissions: Readable<Permission[]> = derived(userRole, ($role) =>
	$role ? ROLE_PERMISSIONS[$role] : []
);
