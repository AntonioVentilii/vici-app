import { Permission } from '$lib/types/permission';
import { UserRole } from '$lib/types/user';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
	[UserRole.CONTROLLER]: [
		Permission.MANAGE_ROLES,
		Permission.RESOLVE_MARKET,
		Permission.CREATE_MARKET,
		Permission.VIEW_ADMIN_PANEL
	],
	[UserRole.ADMIN]: [
		Permission.MANAGE_ROLES,
		Permission.RESOLVE_MARKET,
		Permission.CREATE_MARKET,
		Permission.VIEW_ADMIN_PANEL
	],
	[UserRole.RESOLVER]: [Permission.RESOLVE_MARKET],
	[UserRole.CREATOR]: [Permission.CREATE_MARKET]
};
