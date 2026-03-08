import { Collection } from '$lib/constants/collections.constants';
import type { Activity } from '$lib/types/social';
import type { PrincipalText } from '@dfinity/zod-schemas';
import { listDocs, setDoc } from '@junobuild/core';

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

export const getGlobalActivities = async (limit = 50): Promise<Activity[]> => {
	const { items } = await listDocs<Activity>({
		collection: Collection.ACTIVITIES
	});

	return items
		.map((doc) => doc.data)
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, limit);
};

export const getFriendActivities = async ({
	friends,
	limit = 50
}: {
	friends: PrincipalText[];
	limit?: number;
}): Promise<Activity[]> => {
	const { items } = await listDocs<Activity>({
		collection: Collection.ACTIVITIES
	});

	return items
		.map((doc) => doc.data)
		.filter((a) => friends.includes(a.user))
		.sort((a, b) => b.timestamp - a.timestamp)
		.slice(0, limit);
};
