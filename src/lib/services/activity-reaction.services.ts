import { Collection } from '$lib/constants/collections.constants';
import type { Activity, ActivityReaction } from '$lib/types/social';
import { isNullish, nonNullish } from '@dfinity/utils';
import { deleteDoc, getDoc, listDocs, setDoc } from '@junobuild/core';
import type { PrincipalText } from '@junobuild/schema';

/**
 * Cap on the count-on-read reaction scan. One bounded `listDocs` per feed mount tallies likes
 * client-side (see the persistence spec); past this window counts under-report, which is the
 * documented ceiling that the deferred rollup-counter follow-up removes.
 */
export const ACTIVITY_REACTIONS_READ_LIMIT = 1000;

/**
 * The liked activity's own doc key — `${user}#${timestamp}#${type}`, the shape `logActivity` writes.
 * `getGlobalActivities` drops the doc key, so it's reconstructed from the `Activity` fields (the
 * satellite assert guarantees that exact shape). Shared so the service, store, and component agree.
 */
export const activityReactionKey = ({ activity }: { activity: Activity }): string =>
	`${activity.user}#${activity.timestamp}#${activity.type}`;

const reactionDocKey = ({
	activity,
	liker
}: {
	activity: Activity;
	liker: PrincipalText;
}): string => `${activityReactionKey({ activity })}#${liker}`;

export const likeActivity = async ({
	activity,
	liker
}: {
	activity: Activity;
	liker: PrincipalText;
}): Promise<void> => {
	const activityKey = activityReactionKey({ activity });

	await setDoc<ActivityReaction>({
		collection: Collection.ACTIVITY_REACTIONS,
		doc: {
			key: reactionDocKey({ activity, liker }),
			data: {
				activityKey,
				liker,
				timestamp: Date.now(),
				activityTitle: activity.title,
				// Denormalized for the like-received inbox card (spec B); omit when absent rather than
				// persisting an explicit `undefined`.
				...(nonNullish(activity.marketId) ? { marketId: activity.marketId } : {})
			}
		}
	});
};

export const unlikeActivity = async ({
	activity,
	liker
}: {
	activity: Activity;
	liker: PrincipalText;
}): Promise<void> => {
	const doc = await getDoc<ActivityReaction>({
		collection: Collection.ACTIVITY_REACTIONS,
		key: reactionDocKey({ activity, liker })
	});

	if (isNullish(doc)) {
		return;
	}

	await deleteDoc({
		collection: Collection.ACTIVITY_REACTIONS,
		doc
	});
};

/**
 * The most-recent reactions across all users, bounded by {@link ACTIVITY_REACTIONS_READ_LIMIT}.
 * Counts + the caller's own likes are tallied client-side from this single page (count-on-read).
 */
export const getActivityReactions = async ({
	limit = ACTIVITY_REACTIONS_READ_LIMIT,
	certified = false
}: { limit?: number; certified?: boolean } = {}): Promise<ActivityReaction[]> => {
	if (limit <= 0) {
		return [];
	}

	const { items } = await listDocs<ActivityReaction>({
		collection: Collection.ACTIVITY_REACTIONS,
		filter: {
			order: { field: 'created_at', desc: true },
			paginate: { limit }
		},
		options: { certified }
	});

	return items.map(({ data }) => data);
};

/**
 * Cap on the received-reactions scan — likes on the viewer's OWN calls (the like-received inbox
 * source). Scoped to one author's activities by the key prefix, so this is a small set even when the
 * global feed is busy.
 */
export const RECEIVED_REACTIONS_READ_LIMIT = 200;

/**
 * Every like on `author`'s own activities. The reaction doc key is `${author}#${ts}#${type}#${liker}`,
 * so the author (the liked call's owner) is the key prefix — a single key-prefix `listDocs` returns
 * all likes on their calls, bounded and scoped to that author (not the global feed window). Backs
 * the like-received inbox card; `author` is the viewer's principal.
 */
export const getReceivedActivityReactions = async ({
	author,
	limit = RECEIVED_REACTIONS_READ_LIMIT,
	certified = false
}: {
	author: PrincipalText;
	limit?: number;
	certified?: boolean;
}): Promise<ActivityReaction[]> => {
	if (limit <= 0) {
		return [];
	}

	const { items } = await listDocs<ActivityReaction>({
		collection: Collection.ACTIVITY_REACTIONS,
		filter: {
			// Principal text is `[a-z0-9-]` only, so it carries no regex metacharacters — a bare `^…#`
			// prefix matches exactly the author segment (principals never contain `#`).
			matcher: { key: `^${author}#` },
			order: { field: 'created_at', desc: true },
			paginate: { limit }
		},
		options: { certified }
	});

	return items.map(({ data }) => data);
};

/**
 * Tally reactions into a per-`activityKey` like count (the count-on-read aggregation the feed
 * renders). Viewer-agnostic: which of these the current user liked is derived separately and
 * reactively from `$authPrincipal`, so it stays correct across sign-in without a refresh.
 */
export const countActivityReactions = (reactions: ActivityReaction[]): Map<string, number> => {
	const counts = new Map<string, number>();

	for (const { activityKey } of reactions) {
		counts.set(activityKey, (counts.get(activityKey) ?? 0) + 1);
	}

	return counts;
};
