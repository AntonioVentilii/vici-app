import { Collection } from '$lib/constants/collections.constants';
import { ActivityType } from '$lib/enums/social';
import type { Activity } from '$lib/types/social';
import { listDocs, setDoc, type ListParams } from '@junobuild/core';

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

	// Fetch only the most-recent `limit` docs server-side instead of
	// downloading the entire ACTIVITIES collection and slicing in JS,
	// keeping the call flat as lifetime activity grows.
	//
	// Ordering is by the satellite's `created_at`, not the client-written
	// `data.timestamp` the old code sliced on — Juno can only order by
	// `created_at` / `updated_at` / `keys`, never an arbitrary data field.
	// The two diverge only when a client's clock is skewed or it backdates
	// `timestamp`, in which case the server-assigned `created_at` is the
	// more trustworthy recency signal anyway. The trailing `data.timestamp`
	// sort just stabilises ordering within the returned page.
	const items = await listActivities({
		certified,
		filter: { order: { field: 'created_at', desc: true }, paginate: { limit } }
	});

	return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
};

/**
 * Most-recent SETTLEMENT activities, matched server-side on the
 * `${user}#${timestamp}#${type}` key suffix.
 *
 * Settlements are rare admin actions, so unlike {@link getGlobalActivities} —
 * whose any-type window flushes a settlement row out as soon as `limit` newer
 * trades / comments land — a single page here effectively covers the whole
 * catalog's outcome labels.
 */
export const getSettlementActivities = ({
	limit = 200,
	certified = false
}: { limit?: number; certified?: boolean } = {}): Promise<Activity[]> =>
	listActivities({
		certified,
		filter: {
			matcher: { key: `#${ActivityType.SETTLEMENT}$` },
			order: { field: 'created_at', desc: true },
			paginate: { limit }
		}
	});
