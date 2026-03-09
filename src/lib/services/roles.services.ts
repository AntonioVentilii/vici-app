import { Collection } from '$lib/constants/collections.constants';
import type { UserRole } from '$lib/types/user';
import type { PrincipalText } from '@dfinity/zod-schemas';
import { deleteDoc, getDoc, listDocs, setDoc } from '@junobuild/core';

export interface RoleDoc {
	role: UserRole;
}

export interface UserRoleEntry {
	principal: PrincipalText;
	role: UserRole;
}

export const listRoles = async (): Promise<UserRoleEntry[]> => {
	const { items } = await listDocs<RoleDoc>({
		collection: Collection.ROLES
	});

	return items.map((doc) => ({
		principal: doc.key,
		role: doc.data.role
	}));
};

export const setRole = async ({
	principal,
	role
}: {
	principal: PrincipalText;
	role: UserRole;
}): Promise<void> => {
	const existingDoc = await getDoc<RoleDoc>({
		collection: Collection.ROLES,
		key: principal
	});

	if (existingDoc?.data.role === role) {
		throw new Error(`User already has the role: ${role}`);
	}

	await setDoc({
		collection: Collection.ROLES,
		doc: {
			key: principal,
			data: {
				role
			},
			...(existingDoc && { updated_at: existingDoc.updated_at })
		}
	});
};

export const removeRole = async (principal: PrincipalText): Promise<void> => {
	const existingDoc = await getDoc<RoleDoc>({
		collection: Collection.ROLES,
		key: principal
	});

	if (!existingDoc) {
		throw new Error('User does not have a set role');
	}

	await deleteDoc({
		collection: Collection.ROLES,
		doc: existingDoc
	});
};
