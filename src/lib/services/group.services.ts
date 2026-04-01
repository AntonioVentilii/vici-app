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
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import { getProfile } from '$lib/services/profile.services';
import { Permission } from '$lib/types/permission';
import { Principal } from '@icp-sdk/core/principal';

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
	principals: string[];
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
	principals: string[];
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
	principals: string[];
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
	principals: string[];
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

export const listGroups = async (creator?: string): Promise<RegistryDid.Group[]> => {
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
