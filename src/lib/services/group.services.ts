import type { RegistryDid } from '$declarations';
import {
	addGroupAdmins as addGroupAdminsApi,
	addGroupMembers as addGroupMembersApi,
	createGroup as createGroupApi,
	deleteGroup as deleteGroupApi,
	getGroup as getGroupApi,
	listGroups as listGroupsApi,
	removeGroupAdmins as removeGroupAdminsApi,
	removeGroupMembers as removeGroupMembersApi,
	updateGroup as updateGroupApi,
	updateTradingAccess as updateTradingAccessApi
} from '$lib/api/registry.api';
import { ROLE_PERMISSIONS } from '$lib/constants/authz.constants';
import { Permission } from '$lib/enums/permission';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { getProfile } from '$lib/services/profile.services';
import { getFriends } from '$lib/services/relation.services';
import { Principal } from '@icp-sdk/core/principal';
import type { PrincipalText } from '@junobuild/schema';

const assertPermission = async (permission: Permission): Promise<void> => {
	const identity = await safeGetIdentityOnce();
	const profile = await getProfile(identity.getPrincipal().toText());
	const { role } = profile.data;

	if (role === undefined) {
		throw new Error(`Unauthorized: missing ${permission} permission`);
	}

	const permissions = ROLE_PERMISSIONS[role] ?? [];

	if (!permissions.includes(permission)) {
		throw new Error(`Unauthorized: missing ${permission} permission`);
	}
};

export const createGroup = async ({
	name,
	description,
	iconUrl
}: {
	name: string;
	description?: string;
	iconUrl?: string;
}): Promise<string> => {
	await assertPermission(Permission.CREATE_GROUP);

	const identity = await safeGetIdentityOnce();

	return await createGroupApi({
		identity,
		params: {
			name,
			description: description ? [description] : [],
			icon_url: iconUrl ? [iconUrl] : []
		}
	});
};

export const updateGroup = async ({
	groupId,
	name,
	description,
	iconUrl
}: {
	groupId: string;
	name?: string;
	description?: string | null;
	iconUrl?: string | null;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	return await updateGroupApi({
		identity,
		params: {
			group_id: groupId,
			name: name !== undefined ? [name] : [],
			description: description === undefined ? [] : description === null ? [[]] : [[description]],
			icon_url: iconUrl === undefined ? [] : iconUrl === null ? [[]] : [[iconUrl]]
		}
	});
};

export const addGroupAdmins = async ({
	groupId,
	principals
}: {
	groupId: string;
	principals: PrincipalText[];
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	return await addGroupAdminsApi({
		identity,
		params: {
			group_id: groupId,
			principals: principals.map((p) => Principal.fromText(p))
		}
	});
};

export const removeGroupAdmins = async ({
	groupId,
	principals
}: {
	groupId: string;
	principals: PrincipalText[];
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	return await removeGroupAdminsApi({
		identity,
		params: {
			group_id: groupId,
			principals: principals.map((p) => Principal.fromText(p))
		}
	});
};

export const addGroupMembers = async ({
	groupId,
	principals
}: {
	groupId: string;
	principals: PrincipalText[];
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	return await addGroupMembersApi({
		identity,
		params: {
			group_id: groupId,
			principals: principals.map((p) => Principal.fromText(p))
		}
	});
};

export const removeGroupMembers = async ({
	groupId,
	principals
}: {
	groupId: string;
	principals: PrincipalText[];
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	return await removeGroupMembersApi({
		identity,
		params: {
			group_id: groupId,
			principals: principals.map((p) => Principal.fromText(p))
		}
	});
};

export const getGroup = async (groupId: string): Promise<RegistryDid.Group | undefined> => {
	const identity = await safeGetIdentityOnce();

	return await getGroupApi({ identity, groupId });
};

export const listGroups = async (creator?: PrincipalText): Promise<RegistryDid.Group[]> => {
	const identity = await safeGetIdentityOnce();

	return await listGroupsApi({ identity, creator });
};

export const deleteGroup = async (groupId: string): Promise<void> => {
	const identity = await safeGetIdentityOnce();

	return await deleteGroupApi({ identity, groupId });
};

export const updateTradingAccess = async ({
	seriesId,
	tradingAccess
}: {
	seriesId: string;
	tradingAccess: RegistryDid.TradingAccess[];
}): Promise<void> => {
	await assertPermission(Permission.MANAGE_TRADING_ACCESS);

	const identity = await safeGetIdentityOnce();

	return await updateTradingAccessApi({
		identity,
		params: {
			series_id: seriesId,
			trading_access: tradingAccess
		}
	});
};

export const syncGroupAdminsAfterUnfriend = async ({
	userA,
	userB
}: {
	userA: PrincipalText;
	userB: PrincipalText;
}): Promise<void> => {
	try {
		const groupsA = await listGroups(userA);

		for (const group of groupsA) {
			if (group.admins.some((a) => a.toText() === userB)) {
				await removeGroupAdmins({ groupId: group.group_id, principals: [userB] });
			}
		}

		const groupsB = await listGroups(userB);

		for (const group of groupsB) {
			if (group.admins.some((a) => a.toText() === userA)) {
				await removeGroupAdmins({ groupId: group.group_id, principals: [userA] });
			}
		}
	} catch (e) {
		console.error('Failed to sync group admins after unfriend', e);
	}
};

export const getOrCreateFriendsGroup = async (): Promise<string> => {
	const identity = await safeGetIdentityOnce();
	const principal = identity.getPrincipal().toText();

	const allGroups = await listGroups(principal);
	let friendsGroup = allGroups.find((g) => g.name === 'My Friends');

	if (!friendsGroup) {
		const groupId = await createGroup({
			name: 'My Friends',
			description: 'A private circle for my friends.'
		});
		friendsGroup = await getGroup(groupId);
	}

	if (!friendsGroup) {
		throw new Error('Failed to retrieve friends group after creation');
	}

	// Sync friends
	const activeFriends = await getFriends();
	const friendPrincipals = activeFriends
		.map((f) => f.participants.find((p) => p !== principal))
		.filter((p): p is PrincipalText => p !== undefined);

	const currentMembers = friendsGroup.members.map((m) => m.toText());
	const missingMembers = friendPrincipals.filter((p) => !currentMembers.includes(p));

	if (missingMembers.length > 0) {
		await addGroupMembers({ groupId: friendsGroup.group_id, principals: missingMembers });
	}

	return friendsGroup.group_id;
};

export const getOrCreateFollowersGroup = async (): Promise<string> => {
	const identity = await safeGetIdentityOnce();
	const principal = identity.getPrincipal().toText();

	const allGroups = await listGroups(principal);
	let followersGroup = allGroups.find((g) => g.name === 'My Followers');

	if (!followersGroup) {
		const groupId = await createGroup({
			name: 'My Followers',
			description: 'A private circle for the people who follow me.'
		});
		followersGroup = await getGroup(groupId);
	}

	if (!followersGroup) {
		throw new Error('Failed to retrieve followers group after creation');
	}

	// Sync followers
	const { getFollowers } = await import('$lib/services/relation.services');
	const followerPrincipals = await getFollowers();

	const currentMembers = followersGroup.members.map((m) => m.toText());
	const missingMembers = followerPrincipals.filter((p) => !currentMembers.includes(p));

	if (missingMembers.length > 0) {
		await addGroupMembers({ groupId: followersGroup.group_id, principals: missingMembers });
	}

	return followersGroup.group_id;
};
