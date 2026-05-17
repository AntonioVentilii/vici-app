import { Collection } from '$lib/constants/collections.constants';
import type { Activity } from '$lib/types/social';
import { listDocs, setDoc } from '@junobuild/core';
import type { PrincipalText } from '@junobuild/schema';

export const logActivity = async (activity: Omit<Activity, 'timestamp'>): Promise<void> => {
	const timestamp = Date.now();

	const key = `${activity.user}#${timestamp}#${activity.type}`;

	await setDoc({
		collection: Collection.ACTIVITIES,
		doc: {
			key,
			data: {
				...activity,
				timestamp
			}
		}
	});
};

const listActivities = async ({ certified = false }: { certified?: boolean } = {}): Promise<
	Activity[]
> => {
	const { items } = await listDocs<Activity>({
		collection: Collection.ACTIVITIES,
		options: { certified }
	});

	return items.map(({ data }) => data);
};

export const getGlobalActivities = async ({
	limit = 50,
	certified = false
}: { limit?: number; certified?: boolean } = {}): Promise<Activity[]> => {
	if (limit <= 0) {
		return [];
	}

	const items = await listActivities({ certified });

	return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
};

export const getFriendActivities = async ({
	friends,
	limit = 50,
	certified = false
}: {
	friends: PrincipalText[];
	limit?: number;
	certified?: boolean;
}): Promise<Activity[]> => {
	if (friends.length === 0) {
		return [];
	}

	const items = await listActivities({ certified });

	return items
		.filter((a) => friends.includes(a.user))
		.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
		.slice(0, limit);
};
