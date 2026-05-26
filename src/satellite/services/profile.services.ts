import { Collection } from '$lib/constants/collections.constants';
import { MIN_NICKNAME_LENGTH } from '$lib/constants/profile.constants';
import type { UserRole } from '$lib/enums/user';
import type { UserProfile } from '$lib/types/profile';
import { isNullish } from '@dfinity/utils';
import type { AssertSetDocContext } from '@junobuild/functions';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import { decodeDocData, getDocStore, listDocsStore } from '@junobuild/functions/sdk';
import type { PrincipalText } from '@junobuild/schema';

/**
 * Hydrates AND sanitizes a profile read from the datastore so every field
 * matches `UserProfileSchema` exactly before the value crosses the JS→Rust
 * boundary inside the satellite.
 *
 * Two failure modes to defend against:
 *
 * 1. **Missing required nested fields** — profile docs predate several
 *    fields (most recently `preferences.defaultAmount`), so the Sputnik
 *    JsonData→Candid encoder would trap with `Error converting from js
 *    'JsonData' into type 'Candid': missing field <name>` on the first
 *    legacy row. Fix: backfill nested defaults explicitly.
 *
 * 2. **Extra unknown fields** — older code stored fields like `bio` or
 *    `createdAt`/`updatedAt` that have since been removed from the
 *    schema. `defineQuery`'s result parse validates each row against
 *    `UserProfileSchema`, which uses `strictObject` and *rejects* unknown
 *    keys. A single polluted row makes the whole array parse throw,
 *    `jsResult` is never set, and the Rust caller reads a stale/empty
 *    payload and traps with the misleading `missing field default_amount`
 *    message. Fix: only forward the keys the schema actually knows about.
 *
 * `app_get_profile` happens to work on clean rows because there's only
 * one to encode and it passes parse; `app_list_leaderboard` iterates
 * everyone and hits the first dirty row. So keep this helper authoritative
 * — and keep it in sync with `UserProfileSchema`
 * (`src/lib/schema/profile.schema.ts`).
 */
export const withProfileDefaults = (profile: UserProfile): UserProfile => {
	const incoming = profile.preferences;
	const sanitizedPreferences: UserProfile['preferences'] = {
		defaultAmount: {
			flow: incoming?.defaultAmount?.flow ?? '0',
			manual: incoming?.defaultAmount?.manual ?? '0'
		},
		notify: {
			streakReminder: incoming?.notify?.streakReminder ?? true,
			marketAlerts: incoming?.notify?.marketAlerts ?? true,
			friendActivity: incoming?.notify?.friendActivity ?? false,
			weeklyDigest: incoming?.notify?.weeklyDigest ?? true
		},
		flowSessionLength: incoming?.flowSessionLength ?? 10,
		hapticsEnabled: incoming?.hapticsEnabled ?? true,
		callsPublic: incoming?.callsPublic ?? true,
		flowTags: Array.isArray(incoming?.flowTags) ? incoming.flowTags : [],
		worldCupMode: incoming?.worldCupMode ?? false,
		savedMarketIds: Array.isArray(incoming?.savedMarketIds) ? incoming.savedMarketIds : [],
		favoriteParticipantId: incoming?.favoriteParticipantId ?? '',
		favoriteSide:
			incoming?.favoriteSide === 'YES' || incoming?.favoriteSide === 'NO'
				? incoming.favoriteSide
				: '',
		onboardingCompleted: incoming?.onboardingCompleted ?? false
	};

	return {
		owner: profile.owner,
		nickname: profile.nickname ?? '',
		avatar: profile.avatar ?? '',
		email: profile.email ?? '',
		pnl: profile.pnl ?? 0,
		visibility: profile.visibility,
		role: profile.role,
		totalTrades: profile.totalTrades ?? 0,
		winRate: profile.winRate ?? 0,
		dailyStreak: profile.dailyStreak ?? 0,
		streak: profile.streak ?? 0,
		accuracy: profile.accuracy ?? 0,
		points: profile.points ?? 0,
		level: profile.level ?? 1,
		archetype: profile.archetype ?? '',
		interests: profile.interests ?? [],
		lastActiveDay: profile.lastActiveDay,
		unlockedAchievements: profile.unlockedAchievements ?? [],
		contrarianWins: profile.contrarianWins ?? 0,
		preferences: sanitizedPreferences
	};
};

export const getProfile = (principal: PrincipalText): UserProfile | undefined => {
	const caller = msgCaller();

	const profileDoc = getDocStore({
		collection: Collection.PROFILES,
		key: principal,
		caller
	});

	if (isNullish(profileDoc)) {
		return;
	}

	const profile = decodeDocData<UserProfile>(profileDoc.data);

	const roleDoc = getDocStore({
		collection: Collection.ROLES,
		key: profile.owner,
		caller
	});

	return withProfileDefaults({
		...profile,
		role: roleDoc ? decodeDocData<{ role: UserRole }>(roleDoc.data).role : undefined
	});
};

export const searchProfiles = (query: string): UserProfile[] => {
	const caller = msgCaller();

	const lowerQuery = query.toLowerCase();

	const { items } = listDocsStore({
		collection: Collection.PROFILES,
		caller,
		params: {}
	});

	return items
		.map(([_, item]) => {
			const profile = decodeDocData<UserProfile>(item.data);
			const roleDoc = getDocStore({
				collection: Collection.ROLES,
				key: profile.owner,
				caller
			});

			return withProfileDefaults({
				...profile,
				role: roleDoc ? decodeDocData<{ role: UserRole }>(roleDoc.data).role : undefined
			});
		})
		.filter((p) => {
			const matches = [p.nickname, p.owner].some((val) => val.toLowerCase().includes(lowerQuery));

			return matches;
		});
};

/**
 * Outcome of a nickname validity + uniqueness check. Returned by
 * `checkNicknameAvailability` so the FE can render typed inline errors
 * without parsing error strings.
 *
 * `reason` is set only when `available` is `false`:
 * - `required`  — empty / whitespace.
 * - `too_short` — under `MIN_NICKNAME_LENGTH`.
 * - `taken`     — another principal already owns this nickname.
 */
export type NicknameAvailability =
	| { available: true }
	| { available: false; reason: 'required' | 'too_short' | 'taken' };

/**
 * Shared nickname validator. Used by both the `setDoc` assertion (write-time
 * guard) and the `checkNicknameAvailability` query (read-time hint), so the
 * UI and the satellite always agree on what "taken" means.
 *
 * `excludeKey` is the doc key (principal) to skip when scanning for
 * collisions — pass the editing user's principal so a user's own current
 * nickname doesn't count as a conflict.
 */
export const checkNicknameAvailabilityFn = ({
	nickname,
	excludeKey
}: {
	nickname: string | undefined | null;
	excludeKey?: string;
}): NicknameAvailability => {
	if (isNullish(nickname) || nickname.trim() === '') {
		return { available: false, reason: 'required' };
	}

	const trimmedNickname = nickname.trim();

	if (trimmedNickname.length < MIN_NICKNAME_LENGTH) {
		return { available: false, reason: 'too_short' };
	}

	const normalizedNickname = trimmedNickname.toLowerCase();

	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.PROFILES,
		caller,
		params: {}
	});

	const hasConflict = items
		.filter(([key]) => key !== excludeKey)
		.some(([, item]) => {
			try {
				const existingProfile = decodeDocData<UserProfile>(item.data);

				return existingProfile.nickname?.trim().toLowerCase() === normalizedNickname;
			} catch (_: unknown) {
				return false;
			}
		});

	if (hasConflict) {
		return { available: false, reason: 'taken' };
	}

	return { available: true };
};

export const assertValidNickname = ({
	data: {
		collection,
		key: documentKey,
		data: { proposed }
	}
}: AssertSetDocContext) => {
	if (collection !== Collection.PROFILES) {
		return;
	}

	const { nickname } = decodeDocData<UserProfile>(proposed.data);

	const result = checkNicknameAvailabilityFn({ nickname, excludeKey: documentKey });

	if (result.available) {
		return;
	}

	if (result.reason === 'required') {
		throw new Error('Nickname is required.');
	}

	if (result.reason === 'too_short') {
		throw new Error(`Nickname must be at least ${MIN_NICKNAME_LENGTH} characters.`);
	}

	throw new Error(`The nickname "${nickname}" is already taken.`);
};
