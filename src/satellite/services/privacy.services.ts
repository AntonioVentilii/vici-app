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
 * Checks if two users are friends (mutual, active relationship).
 */
const areFriends = ({
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
 * Checks if the caller is following the target user.
 */
const isFollowing = ({
	caller,
	targetOwner
}: {
	caller: Principal;
	targetOwner: PrincipalText;
}): boolean => {
	const relationId = `follow#${caller.toText()}#${targetOwner}`;

	const relationDoc = getDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		caller
	});

	if (isNullish(relationDoc)) {
		return false;
	}

	const relation = decodeDocData<Relation>(relationDoc.data);

	return relation.category === RelationCategory.FOLLOW && relation.state === RelationState.ACTIVE;
};

/**
 * Checks if the caller has an admin or controller role.
 */
const isAdminOrController = (caller: Principal): boolean => {
	const roleDoc = getDocStore({
		collection: Collection.ROLES,
		key: caller.toText(),
		caller
	});

	if (isNullish(roleDoc)) {
		return false;
	}

	const { role } = decodeDocData<{ role: UserRole }>(roleDoc.data);

	return role === UserRole.ADMIN || role === UserRole.CONTROLLER;
};

/**
 * Checks if a target user has any role.
 */
const hasAnyRole = ({
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
 * Determines if the caller can see the target user's nickname based on visibility settings.
 *
 * - PUBLIC: everyone can see
 * - FRIENDS_AND_FOLLOWERS: friends and followers can see
 * - FRIENDS_ONLY: only mutual friends can see
 * - Admins/controllers can always see nicknames of users who have roles
 */
const canSeeNickname = ({
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

	if (isAdminOrController(caller) && hasAnyRole({ targetOwner: profile.owner, caller })) {
		return true;
	}

	if (areFriends({ caller, targetOwner: profile.owner })) {
		return true;
	}

	if (
		profile.visibility === ProfileVisibility.FRIENDS_AND_FOLLOWERS &&
		isFollowing({ caller, targetOwner: profile.owner })
	) {
		return true;
	}

	return false;
};

/**
 * Redacts profile information if the caller lacks visibility.
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
