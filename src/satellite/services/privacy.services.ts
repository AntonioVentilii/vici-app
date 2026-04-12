import { Collection } from '$lib/constants/collections.constants';
import { ProfileVisibility } from '$lib/enums/profile';
import { RelationCategory, RelationState } from '$lib/enums/relation';
import { UserRole } from '$lib/enums/user';
import type { UserProfile } from '$lib/types/profile';
import type { Relation } from '$lib/types/relation';
import { isNullish } from '@dfinity/utils';
import type { Principal } from '@icp-sdk/core/principal';
import { decodeDocData, getDocStore } from '@junobuild/functions/sdk';
import type { PrincipalText } from '@junobuild/schema';

/**
 * Checks if two users are friends.
 */
export const areFriends = ({
	caller,
	targetOwner
}: {
	caller: Principal;
	targetOwner: PrincipalText;
}): boolean => {
	const relationId = [caller.toText(), targetOwner].sort().join('#');

	const relationDoc = getDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		caller
	});

	if (isNullish(relationDoc)) {
		return false;
	}

	const relation = decodeDocData<Relation>(relationDoc.data);

	return relation.category === RelationCategory.FRIEND && relation.state === RelationState.ACTIVE;
};

/**
 * Checks if a user is an admin.
 */
export const isAdmin = (caller: Principal): boolean => {
	const roleDoc = getDocStore({
		collection: Collection.ROLES,
		key: caller.toText(),
		caller
	});

	if (isNullish(roleDoc)) {
		return false;
	}

	const { role } = decodeDocData<{ role: UserRole }>(roleDoc.data);

	return role === UserRole.ADMIN;
};

/**
 * Checks if a target user has any role.
 */
export const hasAnyRole = ({
	targetOwner,
	caller
}: {
	targetOwner: PrincipalText;
	caller: Principal;
}): boolean => {
	const roleDoc = getDocStore({
		collection: Collection.ROLES,
		key: targetOwner,
		caller
	});

	return !isNullish(roleDoc);
};

/**
 * Determines if the caller can see the target user's nickname.
 */
export const canSeeNickname = ({
	caller,
	profile
}: {
	caller: Principal;
	profile: UserProfile;
}): boolean => {
	if (profile.visibility === ProfileVisibility.PUBLIC) {
		return true;
	}

	if (caller.toText() === profile.owner) {
		return true;
	}

	if (areFriends({ caller, targetOwner: profile.owner })) {
		return true;
	}

	if (isAdmin(caller) && hasAnyRole({ targetOwner: profile.owner, caller })) {
		return true;
	}

	return false;
};

/**
 * Redacts profile information if necessary.
 */
export const redactProfile = ({
	caller,
	profile
}: {
	caller: Principal;
	profile: UserProfile;
}): UserProfile => {
	if (canSeeNickname({ caller, profile })) {
		return profile;
	}

	const truncatedPrincipal = `${profile.owner.slice(0, 5)}...${profile.owner.slice(-3)}`;

	return {
		...profile,
		nickname: `User ${truncatedPrincipal}`,
		bio: '',
		avatar: ''
	};
};
