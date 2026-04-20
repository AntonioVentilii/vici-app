import { Permission } from '$lib/enums/permission';
import { UserRole } from '$lib/enums/user';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
	[UserRole.CONTROLLER]: [
		Permission.MANAGE_ROLES,
		Permission.RESOLVE_MARKET,
		Permission.CREATE_MARKET,
		Permission.VIEW_ADMIN_PANEL,
		Permission.CREATE_GROUP,
		Permission.MANAGE_TRADING_ACCESS
	],
	[UserRole.ADMIN]: [
		Permission.MANAGE_ROLES,
		Permission.RESOLVE_MARKET,
		Permission.CREATE_MARKET,
		Permission.VIEW_ADMIN_PANEL,
		Permission.CREATE_GROUP,
		Permission.MANAGE_TRADING_ACCESS
	],
	[UserRole.SOLVER]: [Permission.RESOLVE_MARKET],
	[UserRole.CREATOR]: [Permission.CREATE_MARKET],
	[UserRole.GROUP_CREATOR]: [Permission.CREATE_GROUP]
};
