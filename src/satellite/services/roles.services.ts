import type { AssertSetDocContext } from '@junobuild/functions';
import { decodeDocData, getControllers, getDocStore, isController } from '@junobuild/functions/sdk';
import { Collection } from '../../lib/constants/collections.constants';
import { UserRole } from '../../lib/types/user';

export const assertSetRole = ({
	caller,
	data: {
		key,
		collection,
		data: { proposed }
	}
}: AssertSetDocContext) => {
	if (collection !== Collection.ROLES) {
		return;
	}

	// 1. Check if caller is a controller
	const controllers = getControllers();
	if (isController({ caller, controllers })) {
		return;
	}

	// 2. Check if caller is an admin by querying their own role in the 'roles' collection
	const callerDoc = getDocStore({
		collection: Collection.ROLES,
		key,
		caller
	});

	if (callerDoc === undefined) {
		throw new Error('You do not have permission to set roles.');
	}

	const { role } = decodeDocData<{ role: UserRole }>(callerDoc.data);

	if (role !== UserRole.ADMIN) {
		throw new Error('Only admins can set roles.');
	}

	// 3. Validate the proposed data
	const { role: newRole } = decodeDocData<{ role: UserRole }>(proposed.data);
	const validRoles = Object.values(UserRole);
	if (!validRoles.includes(newRole)) {
		throw new Error(`Invalid role: ${newRole}`);
	}
};
