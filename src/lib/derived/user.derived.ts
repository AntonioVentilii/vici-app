import { ROLE_PERMISSIONS } from '$lib/constants/authz.constants';
import { SATELLITE_CONTROLLERS } from '$lib/constants/controllers.constants';
import type { Permission } from '$lib/enums/permission';
import { UserRole } from '$lib/enums/user';
import { userStore } from '$lib/stores/user.store';
import { nonNullish } from '@dfinity/utils';
import type { PrincipalText } from '@junobuild/schema';
import { derived, type Readable } from 'svelte/store';

export const userSignedIn: Readable<boolean> = derived(userStore, ({ user }) => nonNullish(user));

export const userNotSignedIn: Readable<boolean> = derived(userSignedIn, (signedIn) => !signedIn);

export const authPrincipal: Readable<PrincipalText | undefined> = derived(
	userStore,
	({ user }) => user?.owner
);

const userIsController: Readable<boolean> = derived(
	[authPrincipal],
	([$authPrincipal]) => nonNullish($authPrincipal) && SATELLITE_CONTROLLERS.includes($authPrincipal)
);

export const userRole: Readable<UserRole | undefined> = derived(
	[userIsController, userStore],
	([$userIsController, { profile }]) => ($userIsController ? UserRole.CONTROLLER : profile?.role)
);

export const userPermissions: Readable<Permission[]> = derived(userRole, ($role) =>
	$role ? ROLE_PERMISSIONS[$role] : []
);

export const userIsAdmin: Readable<boolean> = derived(
	[userIsController, userRole],
	([$userIsController, $userRole]) => $userIsController || $userRole === UserRole.ADMIN
);

export const userIsAdminOrSolver: Readable<boolean> = derived(
	[userIsAdmin, userRole],
	([$userIsAdmin, $userRole]) => $userIsAdmin || $userRole === UserRole.SOLVER
);
