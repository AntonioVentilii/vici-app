import { Collection } from '$lib/constants/collections.constants';
import type { UserRole } from '$lib/enums/user';
import type { UserProfile } from '$lib/types/profile';
import { redactProfile } from '$satellite/services/privacy.services';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import { decodeDocData, getDocStore, listDocsStore } from '@junobuild/functions/sdk';

export const listLeaderboard = (): UserProfile[] => {
	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.PROFILES,
		caller,
		params: {}
	});

	const profiles = items.map(([_, item]) => {
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
	});

	const sortedProfiles = profiles.sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0)).slice(0, 50);

	return sortedProfiles.map((profile) => redactProfile({ caller, profile }));
};
