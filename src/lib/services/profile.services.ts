import type { ClearingDid, RegistryDid } from '$declarations';
import { functions } from '$declarations/satellite/satellite.api';
import { ZERO } from '$lib/constants/app.constants';
import { Collection } from '$lib/constants/collections.constants';
import { ProfileVisibility } from '$lib/enums/profile';
import type { UserRole } from '$lib/enums/user';
import { notifyAchievementsUnlocked } from '$lib/services/achievements.services';
import { getUserTradeHistory } from '$lib/services/trade.services';
import { profilesStore } from '$lib/stores/profiles.store';
import type { Nickname, UserProfile } from '$lib/types/profile';
import {
	CONTRARIAN_PRICE_THRESHOLD,
	evaluateAchievements,
	mergeUnlockedAchievements
} from '$lib/utils/achievements.utils';
import { decimalFixedValueToNumber, shortenWithMiddleEllipsis } from '$lib/utils/format.utils';
import { applyDailyStreakBump } from '$lib/utils/streak.utils';
import { fromWireProfile } from '$satellite/utils/wire-format.utils';
import { isNullish, nonNullish } from '@dfinity/utils';
import type { Identity } from '@icp-sdk/core/agent';
import { getDoc, setDoc, type Doc, type User } from '@junobuild/core';
import type { PrincipalText } from '@junobuild/schema';
import { get } from 'svelte/store';

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
				unlockedAchievements: [],
				contrarianWins: 0,
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

/**
 * Populates `profilesStore` with the principals that aren't already cached.
 * Use this from any surface that renders a counterpart's name/avatar
 * (activity feed, market recent trades, market discussion, friends list, …)
 * instead of keeping a per-component `Map` and a per-component fetch loop.
 *
 * Failures for individual principals are swallowed: the cache simply won't
 * have an entry, and the UI is expected to fall back to a shortened
 * principal. This mirrors what every existing caller was already doing.
 */
export const loadProfilesByPrincipals = async ({
	principals
}: {
	principals: PrincipalText[];
}): Promise<void> => {
	const cached = get(profilesStore);
	const unique = Array.from(new Set(principals)).filter(
		(principal) => principal.length > 0 && !cached.has(principal)
	);

	if (unique.length === 0) {
		return;
	}

	const docs = await Promise.all(
		unique.map((principal) => getProfile(principal).catch(() => undefined))
	);

	profilesStore.update((current) => {
		const next = new Map(current);

		for (let i = 0; i < unique.length; i++) {
			const doc = docs[i];

			if (doc) {
				next.set(unique[i], doc.data);
			}
		}

		return next;
	});
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

	return items.map(fromWireProfile);
};

/**
 * Outcome of a nickname availability probe — mirrors
 * `NicknameAvailability` on the satellite side. The FE uses this to
 * render typed inline errors (instead of regex-parsing thrown messages).
 */
export type NicknameAvailability =
	| { available: true }
	| { available: false; reason: 'required' | 'too_short' | 'taken' };

/**
 * Pre-flight check for the create-account and profile-edit flows.
 * Runs through the same validator the satellite assertion uses
 * (`checkNicknameAvailabilityFn`), so a `true` here means the next
 * `setDoc` will not be vetoed for nickname reasons.
 *
 * Pass the editor's `principal` when editing an existing profile so
 * the user is not told their own current nickname is taken.
 */
export const checkNicknameAvailability = async ({
	nickname,
	principal
}: {
	nickname: string;
	principal?: PrincipalText;
}): Promise<NicknameAvailability> => {
	const result = await functions.checkNicknameAvailability({
		nickname,
		excludePrincipalStr: principal ?? ''
	});

	if (result.available) {
		return { available: true };
	}

	return { available: false, reason: result.reason ?? 'taken' };
};

/**
 * Result of `ensureProfile` — `existed` flags whether the satellite
 * already held a profile doc for this principal at sign-in time. The
 * post-sign-in handoff in `(app)/+layout.svelte` uses this to decide
 * whether to apply a pending pre-auth onboarding payload (new user)
 * or preserve the existing profile (returning user).
 */
export interface EnsureProfileResult {
	profile: UserProfile;
	existed: boolean;
}

export const ensureProfile = async (user: User): Promise<EnsureProfileResult> => {
	const principal = user.key;
	const profileDoc = await getProfile(principal);

	// The synthetic shell from `getProfile` never carries a version. To
	// detect "has the satellite ever stored a profile for this
	// principal?" we have to read the doc directly via Juno's SDK —
	// `version` is only populated on real stored docs. This is what
	// previously caused every returning user to fall through to the
	// upsert path and have any pending onboarding silently overwrite
	// their saved nickname.
	const existing = await getDoc<UserProfile>({
		collection: Collection.PROFILES,
		key: principal
	});

	if (nonNullish(existing) && nonNullish(existing.version)) {
		return { profile: existing.data, existed: true };
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

	// First-touch bootstrap. The default nickname is the user's
	// shortened principal, which can occasionally collide with another
	// shortened principal from a different identity provider — fall
	// back to the unshortened principal so the assertion cannot veto
	// this implicit write. The user can then change it from the
	// profile dashboard.
	try {
		await upsertProfile({ ...profileDoc, data });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : '';

		if (message.includes('already taken')) {
			const fallback: UserProfile = { ...data, nickname: principal };
			await upsertProfile({ ...profileDoc, data: fallback });

			return { profile: fallback, existed: false };
		}

		throw err;
	}

	return { profile: data, existed: false };
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

	// Long-shot wins for the `contrarian` achievement. A settled win
	// at execution price ≤ CONTRARIAN_PRICE_THRESHOLD means the market
	// priced their side as a long shot when they took it.
	const contrarianWins = history.filter((event) => {
		if (!isWin(event)) {
			return false;
		}

		const price = decimalFixedValueToNumber({
			value: event.price.decimal.value,
			decimals: event.price.decimal.decimals
		});

		return price <= CONTRARIAN_PRICE_THRESHOLD;
	}).length;

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

	const profileDoc = await getProfile(principal);

	// Evaluate achievements against the freshly-computed snapshot and
	// fold any newly-unlocked ids into the persisted set. Newly
	// unlocked achievements also credit their XP into the points total
	// before we recompute the level — so an achievement that pushes a
	// user across a 500-point boundary correctly bumps the level in
	// the same write.
	const evaluations = evaluateAchievements({
		totalTrades,
		winStreak: resolvedStreak,
		dailyStreak: profileDoc.data.dailyStreak ?? 0,
		accuracy,
		level: Math.floor(totalPoints / 500) + 1,
		contrarianWins
	});

	const { unlocked, newlyUnlocked } = mergeUnlockedAchievements({
		previouslyUnlocked: profileDoc.data.unlockedAchievements ?? [],
		evaluations
	});

	const bonusXp = newlyUnlocked.reduce((acc, evaluation) => acc + evaluation.def.xp, 0);
	const adjustedPoints = totalPoints + bonusXp;
	const level = Math.floor(adjustedPoints / 500) + 1;

	await upsertProfile({
		...profileDoc,
		data: {
			...profileDoc.data,
			totalTrades,
			winRate,
			pnl: realizedPnl,
			streak: resolvedStreak,
			accuracy,
			points: adjustedPoints,
			level,
			contrarianWins,
			unlockedAchievements: unlocked
		}
	});

	notifyAchievementsUnlocked(newlyUnlocked);
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

	// Re-evaluate so streak-driven achievements (`marathon`) can fire
	// on the very write that crosses the threshold, rather than
	// waiting for the next sign-in `calculateAndSyncStats`. Other
	// achievement axes (trades, accuracy, contrarian) re-use the
	// persisted values — they're not the trigger here.
	const evaluations = evaluateAchievements({
		totalTrades: profileDoc.data.totalTrades ?? 0,
		winStreak: profileDoc.data.streak ?? 0,
		dailyStreak: bump.streak,
		accuracy: profileDoc.data.accuracy ?? 0,
		level: profileDoc.data.level ?? 1,
		contrarianWins: profileDoc.data.contrarianWins ?? 0
	});

	const { unlocked, newlyUnlocked } = mergeUnlockedAchievements({
		previouslyUnlocked: profileDoc.data.unlockedAchievements ?? [],
		evaluations
	});

	const bonusXp = newlyUnlocked.reduce((acc, evaluation) => acc + evaluation.def.xp, 0);
	const points = (profileDoc.data.points ?? 0) + bonusXp;
	const level = bonusXp > 0 ? Math.floor(points / 500) + 1 : (profileDoc.data.level ?? 1);

	await upsertProfile({
		...profileDoc,
		data: {
			...profileDoc.data,
			dailyStreak: bump.streak,
			lastActiveDay: bump.lastActiveDay,
			points,
			level,
			unlockedAchievements: unlocked
		}
	});

	notifyAchievementsUnlocked(newlyUnlocked);
};
