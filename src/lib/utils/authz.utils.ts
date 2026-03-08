import { ROLE_PERMISSIONS } from '$lib/constants/authz.constants';
import type { Permission } from '$lib/types/permission';
import type { UserRole } from '$lib/types/user';
import { isNullish } from '@dfinity/utils';

export const hasPermission = ({
	role,
	permission
}: {
	role: UserRole | undefined;
	permission: Permission;
}): boolean => {
	if (isNullish(role)) {
		return false;
	}

	return ROLE_PERMISSIONS[role].includes(permission);
};
