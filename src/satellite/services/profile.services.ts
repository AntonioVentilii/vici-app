import { Collection } from '$lib/constants/collections.constants';
import { MIN_NICKNAME_LENGTH } from '$lib/constants/profile.constants';
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
 * Outcome of a nickname validity + uniqueness check. Returned by
 * `checkNicknameAvailability` so the FE can render typed inline errors
 * without parsing error strings.
 *
 * `reason` is set only when `available` is `false`:
 * - `required`  — empty / whitespace.
 * - `too_short` — under `MIN_NICKNAME_LENGTH`.
 * - `taken`     — another principal already owns this nickname.
 */
export type NicknameAvailability =
	| { available: true }
	| { available: false; reason: 'required' | 'too_short' | 'taken' };

/**
 * Shared nickname validator. Used by both the `setDoc` assertion (write-time
 * guard) and the `checkNicknameAvailability` query (read-time hint), so the
 * UI and the satellite always agree on what "taken" means.
 *
 * `excludeKey` is the doc key (principal) to skip when scanning for
 * collisions — pass the editing user's principal so a user's own current
 * nickname doesn't count as a conflict.
 */
export const checkNicknameAvailabilityFn = ({
	nickname,
	excludeKey
}: {
	nickname: string | undefined | null;
	excludeKey?: string;
}): NicknameAvailability => {
	if (isNullish(nickname) || nickname.trim() === '') {
		return { available: false, reason: 'required' };
	}

	const trimmedNickname = nickname.trim();

	if (trimmedNickname.length < MIN_NICKNAME_LENGTH) {
		return { available: false, reason: 'too_short' };
	}

	const normalizedNickname = trimmedNickname.toLowerCase();

	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.PROFILES,
		caller,
		params: {}
	});

	const hasConflict = items
		.filter(([key]) => key !== excludeKey)
		.some(([, item]) => {
			try {
				const existingProfile = decodeDocData<UserProfile>(item.data);

				return existingProfile.nickname?.trim().toLowerCase() === normalizedNickname;
			} catch (_: unknown) {
				return false;
			}
		});

	if (hasConflict) {
		return { available: false, reason: 'taken' };
	}

	return { available: true };
};

export const assertValidNickname = ({
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

	const result = checkNicknameAvailabilityFn({ nickname, excludeKey: documentKey });

	if (result.available) {
		return;
	}

	if (result.reason === 'required') {
		throw new Error('Nickname is required.');
	}

	if (result.reason === 'too_short') {
		throw new Error(`Nickname must be at least ${MIN_NICKNAME_LENGTH} characters.`);
	}

	throw new Error(`The nickname "${nickname}" is already taken.`);
};
