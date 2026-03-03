import { Collection } from '$lib/constants/collections.constants';
import type { UserProfile, UserRole } from '$lib/types/user';
import { getDoc, setDoc, type User } from '@junobuild/core';

export const getProfile = async ({ key }: User): Promise<UserProfile | undefined> => {
	const doc = await getDoc<UserProfile>({
		collection: Collection.ROLES,
		key
	});

	return doc?.data;
};

export const setRole = async ({
	user: { key },
	role
}: {
	user: User;
	role: UserRole;
}): Promise<void> => {
	await setDoc<UserProfile>({
		collection: Collection.ROLES,
		doc: {
			key,
			data: {
				role
			}
		}
	});
};
