import type { ActivityType } from '$lib/enums/social';
import type { PrincipalText } from '@junobuild/schema';

export interface Activity {
	type: ActivityType;
	user: PrincipalText;
	targetUser?: PrincipalText;
	marketId?: string;
	title: string;
	details?: string;
	timestamp: number;
}

/**
 * A single like on a friend-feed activity. One doc per `(activity, liker)` in the
 * `activity_reactions` collection, keyed `${actor}#${timestamp}#${type}#${liker}` — the liked
 * activity's doc key (see `logActivity`) plus the liker. `activityTitle` / `marketId` are
 * denormalized copies of the liked activity's fields, written so the like-received inbox card can
 * render without re-fetching the activity; spec A (counts + persistence) doesn't read them.
 */
export interface ActivityReaction {
	activityKey: string;
	liker: PrincipalText;
	timestamp: number;
	activityTitle: string;
	marketId?: string;
}

/**
 * Upper bound on the denormalized `activityTitle` an `activity_reactions` doc may carry — enforced
 * by `assertSetActivityReaction` so a liker can't bloat the doc with an oversized title.
 */
export const ACTIVITY_REACTION_TITLE_MAX_LENGTH = 500;
