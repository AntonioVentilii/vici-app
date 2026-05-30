import { Collection } from '$lib/constants/collections.constants';
import { UserRole } from '$lib/enums/user';
import { isNullish } from '@dfinity/utils';
import type { Principal } from '@icp-sdk/core/principal';
import { decodeDocData, getDocStore } from '@junobuild/functions/sdk';

/**
 * Shared admin check. Reads the caller's `ROLES` doc and returns
 * whether the role is `ADMIN`. Used by services that gate writes
 * (e.g. market metadata, market translations).
 */
export const isAdmin = ({ caller }: { caller: Principal }): boolean => {
	const callerDoc = getDocStore({
		collection: Collection.ROLES,
		key: caller.toText(),
		caller
	});

	if (isNullish(callerDoc)) {
		return false;
	}

	const { role } = decodeDocData<{ role: UserRole }>(callerDoc.data);

	return role === UserRole.ADMIN;
};
