import { Collection } from '$lib/constants/collections.constants';
import type { UserRole } from '$lib/enums/user';
import type { UserProfile } from '$lib/types/profile';
import { redactProfile } from '$satellite/services/privacy.services';
import { isNullish } from '@dfinity/utils';
import type { AssertSetDocContext } from '@junobuild/functions';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import { decodeDocData, getDocStore, listDocsStore } from '@junobuild/functions/sdk';
import type { PrincipalText } from '@junobuild/schema';

export const getProfile = (principal: PrincipalText): UserProfile | undefined => {
	const caller = msgCaller();

	const profileDoc = getDocStore({
		collection: Collection.PROFILES,
		key: principal,
		caller
	});

	if (isNullish(profileDoc)) {
		return;
	}

	const profile = decodeDocData<UserProfile>(profileDoc.data);

	const roleDoc = getDocStore({
		collection: Collection.ROLES,
		key: profile.owner,
		caller
	});

	const profileWithRole = {
		...profile,
		role: roleDoc ? decodeDocData<{ role: UserRole }>(roleDoc.data).role : undefined
	};

	return redactProfile({ caller, profile: profileWithRole });
};

export const searchProfiles = (query: string): UserProfile[] => {
	const caller = msgCaller();

	const lowerQuery = query.toLowerCase();

	const { items } = listDocsStore({
		collection: Collection.PROFILES,
		caller,
		params: {}
	});

	return items
		.map(([_, item]) => {
			const profile = decodeDocData<UserProfile>(item.data);
			const roleDoc = getDocStore({
				collection: Collection.ROLES,
				key: profile.owner,
				caller
			});

			return {
				...profile,
				role: roleDoc ? decodeDocData<{ role: UserRole }>(roleDoc.data).role : undefined
			};
		})
		.filter((p) => {
			const matches = [p.nickname, p.owner].some((val) => val.toLowerCase().includes(lowerQuery));

			return matches;
		})
		.map((profile) => redactProfile({ caller, profile }));
};

/**
 * Asserts that the nickname in the proposed profile document is unique across all users.
 * Performs a case-insensitive check.
 */
export const assertUniqueNickname = ({
	data: {
		collection,
		key: documentKey,
		data: { proposed }
	}
}: AssertSetDocContext) => {
	if (collection !== Collection.PROFILES) {
		return;
	}

	const { nickname } = decodeDocData<UserProfile>(proposed.data);

	if (isNullish(nickname) || nickname.trim() === '') {
		throw new Error('Nickname is required.');
	}

	const normalizedNickname = nickname.trim().toLowerCase();

	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.PROFILES,
		caller,
		params: {}
	});

	for (const [key, item] of items) {
		if (key !== documentKey) {
			try {
				const existingProfile = decodeDocData<UserProfile>(item.data);

				if (existingProfile.nickname?.trim().toLowerCase() === normalizedNickname) {
					throw new Error(`The nickname "${nickname}" is already taken.`);
				}
			} catch (_e) {
				// If decoding fails, skip this item (might be legacy or different format)
			}
		}
	}
};
