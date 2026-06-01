import { Collection } from '$lib/constants/collections.constants';
import type { Activity } from '$lib/types/social';
import { listDocs, setDoc, type ListParams } from '@junobuild/core';
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

const listActivities = async ({
	certified = false,
	filter
}: { certified?: boolean; filter?: ListParams } = {}): Promise<Activity[]> => {
	const { items } = await listDocs<Activity>({
		collection: Collection.ACTIVITIES,
		filter,
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

	// Fetch only the most-recent `limit` docs server-side — ordered by the
	// satellite's `created_at`, which tracks log insertion order — instead
	// of downloading the entire ACTIVITIES collection and slicing in JS.
	// This keeps the call flat as lifetime activity grows. The trailing
	// `data.timestamp` sort just stabilises ordering within the small page.
	const items = await listActivities({
		certified,
		filter: { order: { field: 'created_at', desc: true }, paginate: { limit } }
	});

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

	// Activity keys are `${user}#${timestamp}#${type}`, so anchor a key
	// regex to the friend principals to filter by author server-side and
	// fetch only the most-recent `limit` matches — instead of pulling the
	// whole ACTIVITIES collection just to keep a few friends' rows.
	// Principals are base32 + `-`, none of which are regex metacharacters,
	// so they're safe to inline into the alternation. The client-side
	// filter below stays as defense-in-depth.
	const items = await listActivities({
		certified,
		filter: {
			matcher: { key: `^(${friends.join('|')})#` },
			order: { field: 'created_at', desc: true },
			paginate: { limit }
		}
	});

	return items
		.filter((a) => friends.includes(a.user))
		.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
		.slice(0, limit);
};
