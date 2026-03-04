import { Collection } from '$lib/constants/collections.constants';
import type { UserProfile } from '$lib/types/profile';
import type { UserRole } from '$lib/types/user';
import { isNullish } from '@dfinity/utils';
import type { PrincipalText } from '@dfinity/zod-schemas';
import { getDoc, listDocs, setDoc } from '@junobuild/core';

export const getProfile = async (principal: PrincipalText): Promise<UserProfile | undefined> => {
	const profileDoc = await getDoc<UserProfile>({
		collection: Collection.PROFILES,
		key: principal
	});

	if (isNullish(profileDoc)) {
		return;
	}

	const roleDoc = await getDoc<{ role: UserRole }>({
		collection: Collection.ROLES,
		key: principal
	});

	return {
		...profileDoc.data,
		role: roleDoc?.data.role
	};
};

export const upsertProfile = async (profile: UserProfile): Promise<void> => {
	await setDoc({
		collection: Collection.PROFILES,
		doc: {
			key: profile.owner,
			data: {
				...profile,
				updatedAt: Date.now()
			}
		}
	});
};

export const searchProfiles = async (query: string): Promise<UserProfile[]> => {
	const { items } = await listDocs<UserProfile>({
		collection: Collection.PROFILES
	});

	const lowerQuery = query.toLowerCase();

	return items
		.map((doc) => doc.data)
		.filter(
			(p) =>
				p.nickname.toLowerCase().includes(lowerQuery) || p.owner.toLowerCase().includes(lowerQuery)
		);
};
