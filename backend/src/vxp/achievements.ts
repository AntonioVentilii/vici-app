// Achievement-unlock awards: when an id appears in the profile's
// unlockedAchievements for the first time, the achievement's catalog XP
// value is minted as real, spendable VXP, once per account (the array is
// append-only client-side, and the achievement/<id> award key is the
// structural backstop). Only the delta on this write pays; achievements
// already unlocked before the write are never retroactively minted.

import { nonNullish } from '@dfinity/utils';
import { logger } from '../lib/logger';
import { grantAward } from './awards';
import { ACHIEVEMENT_XP, parseVxp } from './constants';

/** Ids newly present in next versus prev: the achievements unlocked on this
 * write. Empty in the common case. */
export const newlyUnlocked = ({ prev, next }: { prev: string[]; next: string[] }): string[] => {
	if (next.length === 0) {
		return [];
	}

	const known = new Set(prev);

	return next.filter((id) => !known.has(id));
};

/** Profile-write trigger: mints the catalog value for every achievement
 * unlocked on this write. Unknown ids and non-positive values mint nothing. */
export const runAchievementAwardTrigger = async ({
	userId,
	prevUnlocked,
	nextUnlocked
}: {
	userId: string;
	prevUnlocked: string[];
	nextUnlocked: string[];
}): Promise<void> => {
	const unlocked = newlyUnlocked({ prev: prevUnlocked, next: nextUnlocked }).filter((id) => {
		const xp: number | undefined = ACHIEVEMENT_XP[id];

		return nonNullish(xp) && xp > 0;
	});

	for (const achievementId of unlocked) {
		try {
			await grantAward({
				userId,
				awardType: 'achievement',
				awardKey: achievementId,
				amountBaseUnits: parseVxp(ACHIEVEMENT_XP[achievementId] ?? 0),
				memo: `vxp:achievement:${achievementId}`
			});
		} catch (err) {
			logger.error(`achievement award grant failed (${achievementId} for ${userId}):`, err);
		}
	}
};
