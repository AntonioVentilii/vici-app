import type { ClearingDid, RegistryDid } from '$declarations';
import { functions } from '$declarations/satellite/satellite.api';
import { ZERO } from '$lib/constants/app.constants';
import { Collection } from '$lib/constants/collections.constants';
import { ProfileVisibility } from '$lib/enums/profile';
import type { UserRole } from '$lib/enums/user';
import { getUserTradeHistory } from '$lib/services/trade.services';
import type { Nickname, UserProfile } from '$lib/types/profile';
import { decimalFixedValueToNumber, shortenWithMiddleEllipsis } from '$lib/utils/format.utils';
import { isNullish, nonNullish } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';
import { getDoc, setDoc, type Doc, type User } from '@junobuild/core';
import type { PrincipalText } from '@junobuild/schema';

const toOwnerText = (owner: unknown): PrincipalText =>
	typeof owner === 'string' ? owner : (owner as { toText: () => string }).toText();

/**
 * Loads a user profile from Juno or returns a default shell; merges role from the satellite query.
 */
export const getProfile = async (principal: PrincipalText): Promise<Doc<UserProfile>> => {
	const { profile } = (await functions.getProfile({ principal })) as {
		profile: Record<string, unknown> | undefined;
	};

	if (isNullish(profile)) {
		return {
			key: principal,
			data: {
				owner: principal,
				nickname: shortenWithMiddleEllipsis({ text: principal, splitLength: 5 }),
				bio: '',
				avatar: '',
				pnl: 0,
				visibility: ProfileVisibility.FRIENDS_ONLY,
				totalTrades: 0,
				winRate: 0,
				dailyStreak: 0,
				streak: 0,
				accuracy: 0,
				points: 0,
				level: 1,
				interests: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
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
		data: {
			...(profile as UserProfile),
			owner: toOwnerText(profile.owner),
			role: (profile.role as UserRole) ?? undefined
		}
	};
};

/**
 * Updates interest tags on the user's profile.
 */
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
 * Writes profile data and bumps `updatedAt`.
 */
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
		...profileDoc.data,
		updatedAt: Date.now()
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
	const { items } = (await functions.searchProfiles({ query })) as {
		items: Record<string, unknown>[];
	};

	return items.map((p) => ({
		...(p as UserProfile),
		owner: toOwnerText(p.owner)
	}));
};

/**
 * Ensures a profile document exists in Juno, then returns its data.
 */
export const ensureProfile = async (user: User): Promise<UserProfile> => {
	const principal = user.key;
	const profileDoc = await getProfile(principal);

	if (nonNullish(profileDoc.version)) {
		return profileDoc.data;
	}

	let { nickname } = profileDoc.data;
	const { details } = user.data as { details?: Record<string, unknown> };

	if (nonNullish(details) && 'profile' in details && nonNullish(details.profile)) {
		const gProfile = details.profile as {
			name?: string;
			given_name?: string;
			family_name?: string;
		};
		const fullName =
			gProfile.name ?? [gProfile.given_name, gProfile.family_name].filter(Boolean).join(' ');

		if (fullName.trim().length > 0) {
			nickname = fullName;
		}
	}

	const data: UserProfile = {
		...profileDoc.data,
		nickname
	};

	await upsertProfile({ ...profileDoc, data });

	return data;
};

/**
 * Returns the display name.
 * Profiles are now redacted server-side, but we still handle fallback to principal if needed.
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
	const { isFriend } = (await functions.checkFriendship({ userA, userB })) as {
		isFriend: boolean;
	};

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

	let wins = 0;
	let settledTradesCount = 0;

	history.forEach((event: ClearingDid.Event) => {
		if ('Executed' in event.event_type) {
			// Track executed trades
		}

		if ('Settled' in event.event_type) {
			settledTradesCount++;

			if (event.qty > ZERO) {
				wins++;
			}
		}
	});

	const realizedPnl = history.reduce((acc, event) => {
		if ('Settled' in event.event_type) {
			const priceVal = decimalFixedValueToNumber({
				value: event.price.decimal.value,
				decimals: event.price.decimal.decimals
			});

			return acc + (Number(event.qty) / 1e8) * priceVal;
		}

		return acc;
	}, 0);

	const totalTrades = history.filter((e) => 'Executed' in e.event_type).length;
	const winRate = settledTradesCount > 0 ? (wins / settledTradesCount) * 100 : 0;

	let currentStreak = 0;
	const sortedHistory = [...history].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

	for (const event of sortedHistory) {
		if ('Settled' in event.event_type) {
			if (event.qty > ZERO) {
				currentStreak++;
			} else {
				break;
			}
		}
	}

	const accuracy = winRate;
	let totalPoints = 0;
	let runningStreak = 0;

	const chronoHistory = [...history].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

	chronoHistory.forEach((event) => {
		if ('Settled' in event.event_type) {
			if (event.qty > ZERO) {
				runningStreak++;
				const priceVal = decimalFixedValueToNumber({
					value: event.price.decimal.value,
					decimals: event.price.decimal.decimals
				});
				const weight = priceVal > 0 ? 1.0 / priceVal : 1.0;
				const multiplier = Math.pow(1.1, runningStreak - 1);
				totalPoints += Math.floor(100 * weight * multiplier);
			} else {
				runningStreak = 0;
			}
		} else if ('Executed' in event.event_type) {
			totalPoints += 10;
		}
	});

	const level = Math.floor(totalPoints / 500) + 1;

	const profileDoc = await getProfile(principal);

	await upsertProfile({
		...profileDoc,
		data: {
			...profileDoc.data,
			totalTrades,
			winRate,
			pnl: realizedPnl,
			streak: currentStreak,
			accuracy,
			points: totalPoints,
			level
		}
	});
};

/**
 * Updates daily login streak when the calendar day changes.
 */
export const recordActivity = async (principal: PrincipalText): Promise<void> => {
	const profileDoc = await getProfile(principal);
	const [today] = new Date().toISOString().split('T');
	const lastDay = profileDoc.data.lastActiveDay;

	if (lastDay === today) {
		return;
	}

	let newStreak = 1;

	if (nonNullish(lastDay)) {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const [yesterdayStr] = yesterday.toISOString().split('T');

		if (lastDay === yesterdayStr) {
			newStreak = (profileDoc.data.dailyStreak ?? 0) + 1;
		}
	}

	await upsertProfile({
		...profileDoc,
		data: {
			...profileDoc.data,
			dailyStreak: newStreak,
			lastActiveDay: today
		}
	});
};
