import type { ClearingDid, RegistryDid } from '$declarations';
import { functions } from '$declarations/satellite/satellite.api';
import { ZERO } from '$lib/constants/app.constants';
import { Collection } from '$lib/constants/collections.constants';
import { ProfileVisibility } from '$lib/enums/profile';
import type { UserRole } from '$lib/enums/user';
import { getUserTradeHistory } from '$lib/services/trade.services';
import type { Nickname, UserProfile } from '$lib/types/profile';
import { decimalFixedValueToNumber, shortenWithMiddleEllipsis } from '$lib/utils/format.utils';
import { applyDailyStreakBump } from '$lib/utils/streak.utils';
import { isNullish, nonNullish } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';
import { getDoc, setDoc, type Doc, type User } from '@junobuild/core';
import type { PrincipalText } from '@junobuild/schema';

/**
 * Loads a user profile from Juno or returns a default shell; merges role from the satellite query.
 */
export const getProfile = async (principal: PrincipalText): Promise<Doc<UserProfile>> => {
	const { profile } = await functions.getProfile({ principalStr: principal });

	if (isNullish(profile)) {
		return {
			key: principal,
			data: {
				owner: principal,
				nickname: shortenWithMiddleEllipsis({ text: principal, splitLength: 5 }),
				avatar: '',
				email: '',
				pnl: 0,
				visibility: ProfileVisibility.FRIENDS_ONLY,
				totalTrades: 0,
				winRate: 0,
				dailyStreak: 0,
				streak: 0,
				accuracy: 0,
				points: 0,
				level: 1,
				archetype: '',
				interests: [],
				preferences: {
					defaultAmount: {
						flow: '1.0',
						manual: '1.0'
					}
				}
			}
		};
	}

	return {
		key: principal,
		data: profile as UserProfile
	};
};

export const updateInterests = async ({
	principal,
	interests
}: {
	principal: PrincipalText;
	interests: string[];
}): Promise<void> => {
	const profileDoc = await getProfile(principal);

	await upsertProfile({
		...profileDoc,
		data: {
			...profileDoc.data,
			interests
		}
	});
};

/**
 * Persist the user's daily-streak engine state. Called from Flow Mode
 * after `applyDailyStreakBump` flips the locally held value, so a
 * refresh mid-session doesn't reset the Flame stage.
 *
 * Best-effort — callers should fire-and-forget; the local UI already
 * reflects the bumped values for the rest of the session even if the
 * round-trip fails.
 */
export const persistDailyStreak = async ({
	principal,
	dailyStreak,
	lastActiveDay
}: {
	principal: PrincipalText;
	dailyStreak: number;
	lastActiveDay: string;
}): Promise<UserProfile> => {
	const profileDoc = await getProfile(principal);
	const data: UserProfile = {
		...profileDoc.data,
		dailyStreak,
		lastActiveDay
	};

	await upsertProfile({ ...profileDoc, data });

	return data;
};

export const upsertProfile = async (
	profileDoc: Doc<UserProfile> | { key: string; data: UserProfile }
): Promise<void> => {
	const { key } = profileDoc;
	const existing = await getDoc<UserProfile>({
		collection: Collection.PROFILES,
		key
	});

	const data: UserProfile = {
		...(existing?.data ?? profileDoc.data),
		...profileDoc.data
	};

	if (isNullish(existing)) {
		await setDoc({
			collection: Collection.PROFILES,
			doc: { key, data }
		});

		return;
	}

	if (isNullish(existing.version)) {
		throw new Error('Cannot update profile: document is missing version.');
	}

	await setDoc({
		collection: Collection.PROFILES,
		doc: {
			key,
			version: existing.version,
			data
		}
	});
};

/**
 * Case-insensitive search over nickname, owner, and document key via secure satellite query.
 */
export const searchProfiles = async (query: string): Promise<UserProfile[]> => {
	const { items } = await functions.searchProfiles({ queryStr: query });

	return items as UserProfile[];
};

export const ensureProfile = async (user: User): Promise<UserProfile> => {
	const principal = user.key;
	const profileDoc = await getProfile(principal);

	if (nonNullish(profileDoc.version)) {
		return profileDoc.data;
	}

	const { details } = user.data as { details?: Record<string, unknown> };
	const gProfile =
		nonNullish(details) && 'profile' in details && nonNullish(details.profile)
			? (details.profile as {
					name?: string;
					given_name?: string;
					family_name?: string;
				})
			: undefined;
	const fullName = nonNullish(gProfile)
		? (gProfile.name ?? [gProfile.given_name, gProfile.family_name].filter(Boolean).join(' '))
		: '';
	const nickname = fullName.trim().length > 0 ? fullName : profileDoc.data.nickname;

	const data: UserProfile = {
		...profileDoc.data,
		nickname
	};

	await upsertProfile({ ...profileDoc, data });

	return data;
};

/**
 * Profiles are redacted server-side per visibility rules; this still falls back
 * to a shortened principal so the UI never renders an empty name.
 */
export const getDisplayName = ({
	profile
}: {
	profile: {
		owner: PrincipalText;
		nickname: Nickname;
		visibility?: ProfileVisibility;
	};
	viewerPrincipal?: PrincipalText;
	viewerRole?: UserRole;
	isFriend?: boolean;
}): string => {
	if (!profile.nickname || profile.nickname.trim() === '') {
		return shortenWithMiddleEllipsis({ text: profile.owner });
	}

	return profile.nickname;
};

/**
 * Checks if two users have an active friend relation via secure satellite query.
 */
export const checkFriendship = async ({
	userA,
	userB
}: {
	userA: PrincipalText;
	userB: PrincipalText;
}): Promise<boolean> => {
	const { isFriend } = await functions.checkFriendship({ userA, userB });

	return isFriend;
};

/**
 * Derives trading stats, points, and level from clearing history and writes them to the profile.
 */
export const calculateAndSyncStats = async ({
	identity,
	domain
}: {
	identity: Identity;
	domain: RegistryDid.BalanceDomain;
}): Promise<void> => {
	const principal = identity.getPrincipal().toText();
	const history = await getUserTradeHistory(domain);

	const isSettled = (event: ClearingDid.Event): boolean => 'Settled' in event.event_type;
	const isExecuted = (event: ClearingDid.Event): boolean => 'Executed' in event.event_type;
	const isWin = (event: ClearingDid.Event): boolean => isSettled(event) && event.qty > ZERO;

	const settledTradesCount = history.filter(isSettled).length;
	const wins = history.filter(isWin).length;

	const realizedPnl = history.filter(isSettled).reduce(
		(acc, event) =>
			acc +
			(Number(event.qty) / 1e8) *
				decimalFixedValueToNumber({
					value: event.price.decimal.value,
					decimals: event.price.decimal.decimals
				}),
		0
	);

	const totalTrades = history.filter(isExecuted).length;
	const winRate = settledTradesCount > 0 ? (wins / settledTradesCount) * 100 : 0;

	const sortedHistory = [...history].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
	const currentStreak = sortedHistory.filter(isSettled).findIndex((event) => event.qty <= ZERO);
	const resolvedStreak =
		currentStreak === -1 ? sortedHistory.filter(isSettled).length : currentStreak;

	const accuracy = winRate;

	const chronoHistory = [...history].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

	const { totalPoints } = chronoHistory.reduce<{ totalPoints: number; runningStreak: number }>(
		(acc, event) => {
			if (isSettled(event)) {
				if (event.qty > ZERO) {
					const nextStreak = acc.runningStreak + 1;
					const priceVal = decimalFixedValueToNumber({
						value: event.price.decimal.value,
						decimals: event.price.decimal.decimals
					});
					const weight = priceVal > 0 ? 1.0 / priceVal : 1.0;
					const multiplier = Math.pow(1.1, nextStreak - 1);

					return {
						totalPoints: acc.totalPoints + Math.floor(100 * weight * multiplier),
						runningStreak: nextStreak
					};
				}

				return { totalPoints: acc.totalPoints, runningStreak: 0 };
			}

			if (isExecuted(event)) {
				return { totalPoints: acc.totalPoints + 10, runningStreak: acc.runningStreak };
			}

			return acc;
		},
		{ totalPoints: 0, runningStreak: 0 }
	);

	const level = Math.floor(totalPoints / 500) + 1;

	const profileDoc = await getProfile(principal);

	await upsertProfile({
		...profileDoc,
		data: {
			...profileDoc.data,
			totalTrades,
			winRate,
			pnl: realizedPnl,
			streak: resolvedStreak,
			accuracy,
			points: totalPoints,
			level
		}
	});
};

/**
 * Record that the user did something predictable today — bumps the
 * daily-streak engine and persists the result. Currently called from
 * the trade-execution path (`placeOrder`) so a successful trade keeps
 * the Flame alive for the day.
 *
 * Uses the same `applyDailyStreakBump` engine as Flow Mode, so the
 * two writers produce identical values for the same local day — no
 * race, no UTC-vs-local drift. Same-day calls early-return without
 * a write.
 */
export const recordActivity = async (principal: PrincipalText): Promise<void> => {
	const profileDoc = await getProfile(principal);
	const bump = applyDailyStreakBump({
		streak: profileDoc.data.dailyStreak ?? 0,
		lastActiveDay: profileDoc.data.lastActiveDay
	});

	if (!bump.bumped) {
		return;
	}

	await upsertProfile({
		...profileDoc,
		data: {
			...profileDoc.data,
			dailyStreak: bump.streak,
			lastActiveDay: bump.lastActiveDay
		}
	});
};
