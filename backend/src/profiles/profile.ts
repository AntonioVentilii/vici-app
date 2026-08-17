// Profile domain: the client-synced profile doc backed by typed columns,
// with the server-enforced guards (nickname validity + uniqueness, the
// handle-change cooldown, daily-goal monotonicity) applied on every write.

import { isNullish, nonNullish } from '@dfinity/utils';
import { query, tx, type TxQuery } from '../db/client';
import { fanoutProfileDeltaToLeagueStats } from '../leagues/stats';
import { DAILY_HARD_CAP } from './flow';
import {
	checkNicknameAvailability,
	HANDLE_LAST_CHANGE_TOLERANCE_MS,
	handleCooldownDaysLeft,
	MIN_NICKNAME_LENGTH,
	nicknameUniqueKey
} from './nickname';

/** Client-facing validation failure: routes answer it as a 400/409 with the
 * message, mirroring the write-guard errors clients already handle. */
export class ProfileValidationError extends Error {}

export type ProfileVisibility = 'public' | 'friends_and_followers' | 'friends_only';

export const PROFILE_VISIBILITIES: readonly ProfileVisibility[] = [
	'public',
	'friends_and_followers',
	'friends_only'
];

export interface ProfileRow {
	user_id: string;
	nickname: string;
	avatar: string;
	avatar_parts: string;
	email: string;
	pnl: number;
	visibility: ProfileVisibility;
	total_trades: number;
	win_rate: number;
	daily_streak: number;
	longest_streak: number;
	daily_goal_done: number;
	daily_goal_date: string | null;
	streak: number;
	accuracy: number;
	points: number;
	level: number;
	archetype: string;
	interests: string[];
	last_active_day: string | null;
	deleted_at_ms: string | null;
	hibernated_at_ms: string | null;
	unlocked_achievements: string[];
	contrarian_wins: number;
	best_upset_consensus: number | null;
	on_fire_streak: number;
	comebacks: number;
	winning_categories: number;
	leagues_joined: number;
	bouts_won: number;
	leagues_founded: number;
	top_decile_streak: number;
	last_top_decile_day: string | null;
	sharpest_eye_best_tier: string | null;
	school_status: string | null;
	earned_menagerie: string[] | null;
	handle_last_change_ms: string | null;
	preferences: Record<string, unknown>;
	role?: string | null;
}

/** Cross-device user settings bag, sanitized to a complete shape on read. */
export interface ProfilePreferences {
	defaultAmount: { flow: string; manual: string };
	notify: {
		streakReminder: boolean;
		marketAlerts: boolean;
		friendActivity: boolean;
		weeklyDigest: boolean;
	};
	flowSessionLength: number;
	hapticsEnabled: boolean;
	soundEnabled: boolean;
	sharing: {
		profileVisibility: 'public' | 'friends' | 'private';
		callsPublic: boolean;
		leaderboardOptIn: boolean;
		worldsOptIn: boolean;
	};
	flowTags: string[];
	worldCupMode: boolean;
	savedMarketIds: string[];
	favoriteParticipantId: string;
	favoriteSide: 'YES' | 'NO' | '';
	onboardingCompleted: boolean;
}

/** API shape of a profile: the stored doc plus the hydrated role. */
export interface Profile {
	userId: string;
	nickname: string;
	avatar: string;
	avatarParts: string;
	email: string;
	pnl: number;
	visibility: ProfileVisibility;
	role?: string;
	totalTrades: number;
	winRate: number;
	dailyStreak: number;
	longestStreak: number;
	dailyGoalDone: number;
	dailyGoalDate?: string;
	streak: number;
	accuracy: number;
	points: number;
	level: number;
	archetype: string;
	interests: string[];
	lastActiveDay?: string;
	deletedAtMs?: number;
	hibernatedAtMs?: number;
	unlockedAchievements: string[];
	contrarianWins: number;
	bestUpsetConsensus?: number;
	onFireStreak: number;
	comebacks: number;
	winningCategories: number;
	leaguesJoined: number;
	boutsWon: number;
	leaguesFounded: number;
	topDecileStreak: number;
	lastTopDecileDay?: string;
	sharpestEyeBestTier?: string;
	schoolStatus?: string;
	earnedMenagerie?: string[];
	handleLastChangeMs?: number;
	preferences: ProfilePreferences;
}

/** Map the persisted visibility to the three-way sharing choice, so legacy
 * rows without a stored sharing slice reflect their actual visibility. */
const visibilityToSharing = (
	visibility: ProfileVisibility | undefined
): 'public' | 'friends' | 'private' => {
	if (visibility === 'public') {
		return 'public';
	}

	if (visibility === 'friends_and_followers') {
		return 'friends';
	}

	return 'private';
};

const asRecord = (value: unknown): Record<string, unknown> =>
	typeof value === 'object' && nonNullish(value) && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

const asBoolean = (value: unknown, fallback: boolean): boolean =>
	typeof value === 'boolean' ? value : fallback;

const asString = (value: unknown, fallback: string): string =>
	typeof value === 'string' ? value : fallback;

const asStringArray = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/**
 * Hydrates AND sanitizes the preferences bag so every field is present with
 * its default before the value reaches a client. Missing nested fields are
 * backfilled (legacy rows predate several of them) and unknown keys are
 * dropped, keeping the read shape canonical.
 */
export const sanitizePreferences = ({
	preferences,
	visibility
}: {
	preferences: unknown;
	visibility: ProfileVisibility | undefined;
}): ProfilePreferences => {
	const incoming = asRecord(preferences);
	const defaultAmount = asRecord(incoming.defaultAmount);
	const notify = asRecord(incoming.notify);
	const sharing = asRecord(incoming.sharing);
	const sharingVisibility = sharing.profileVisibility;

	return {
		defaultAmount: {
			flow: asString(defaultAmount.flow, '0'),
			manual: asString(defaultAmount.manual, '0')
		},
		notify: {
			streakReminder: asBoolean(notify.streakReminder, true),
			marketAlerts: asBoolean(notify.marketAlerts, true),
			friendActivity: asBoolean(notify.friendActivity, false),
			weeklyDigest: asBoolean(notify.weeklyDigest, true)
		},
		flowSessionLength:
			typeof incoming.flowSessionLength === 'number' && Number.isFinite(incoming.flowSessionLength)
				? incoming.flowSessionLength
				: 10,
		hapticsEnabled: asBoolean(incoming.hapticsEnabled, true),
		soundEnabled: asBoolean(incoming.soundEnabled, true),
		sharing: {
			profileVisibility:
				sharingVisibility === 'public' ||
				sharingVisibility === 'friends' ||
				sharingVisibility === 'private'
					? sharingVisibility
					: visibilityToSharing(visibility),
			callsPublic: asBoolean(sharing.callsPublic, true),
			leaderboardOptIn: asBoolean(sharing.leaderboardOptIn, true),
			worldsOptIn: asBoolean(sharing.worldsOptIn, true)
		},
		flowTags: asStringArray(incoming.flowTags),
		worldCupMode: asBoolean(incoming.worldCupMode, false),
		savedMarketIds: asStringArray(incoming.savedMarketIds),
		favoriteParticipantId: asString(incoming.favoriteParticipantId, ''),
		favoriteSide:
			incoming.favoriteSide === 'YES' || incoming.favoriteSide === 'NO'
				? incoming.favoriteSide
				: '',
		onboardingCompleted: asBoolean(incoming.onboardingCompleted, false)
	};
};

const optionalMs = (value: string | null): number | undefined =>
	nonNullish(value) ? Number(value) : undefined;

/** Shape a stored row into the API profile: defaults applied, role hydrated
 * from the users table ('user' is the canonical "no role" state). */
export const shapeProfile = (row: ProfileRow): Profile => ({
	userId: row.user_id,
	nickname: row.nickname ?? '',
	avatar: row.avatar ?? '',
	avatarParts: row.avatar_parts ?? '',
	email: row.email ?? '',
	pnl: row.pnl ?? 0,
	visibility: row.visibility,
	...(nonNullish(row.role) && row.role !== 'user' ? { role: row.role } : {}),
	totalTrades: row.total_trades ?? 0,
	winRate: row.win_rate ?? 0,
	dailyStreak: row.daily_streak ?? 0,
	longestStreak: row.longest_streak ?? 0,
	dailyGoalDone: row.daily_goal_done ?? 0,
	dailyGoalDate: row.daily_goal_date ?? undefined,
	streak: row.streak ?? 0,
	accuracy: row.accuracy ?? 0,
	points: row.points ?? 0,
	level: row.level ?? 1,
	archetype: row.archetype ?? '',
	interests: row.interests ?? [],
	lastActiveDay: row.last_active_day ?? undefined,
	deletedAtMs: optionalMs(row.deleted_at_ms),
	hibernatedAtMs: optionalMs(row.hibernated_at_ms),
	unlockedAchievements: row.unlocked_achievements ?? [],
	contrarianWins: row.contrarian_wins ?? 0,
	bestUpsetConsensus: row.best_upset_consensus ?? undefined,
	onFireStreak: row.on_fire_streak ?? 0,
	comebacks: row.comebacks ?? 0,
	winningCategories: row.winning_categories ?? 0,
	leaguesJoined: row.leagues_joined ?? 0,
	boutsWon: row.bouts_won ?? 0,
	leaguesFounded: row.leagues_founded ?? 0,
	topDecileStreak: row.top_decile_streak ?? 0,
	lastTopDecileDay: row.last_top_decile_day ?? undefined,
	sharpestEyeBestTier: row.sharpest_eye_best_tier ?? undefined,
	schoolStatus: row.school_status ?? undefined,
	earnedMenagerie: row.earned_menagerie ?? undefined,
	handleLastChangeMs: optionalMs(row.handle_last_change_ms),
	preferences: sanitizePreferences({ preferences: row.preferences, visibility: row.visibility })
});

/** A profile is hidden from PUBLIC reads iff it is soft-deleted OR
 * hibernated. The owner's own read is never gated, so the client can still
 * offer recovery / resume. */
export const isPubliclyHidden = (
	row: Pick<ProfileRow, 'deleted_at_ms' | 'hibernated_at_ms'>
): boolean => nonNullish(row.deleted_at_ms) || nonNullish(row.hibernated_at_ms);

export const PROFILE_COLUMNS = `p.user_id, p.nickname, p.avatar, p.avatar_parts, p.email, p.pnl,
	p.visibility, p.total_trades, p.win_rate, p.daily_streak, p.longest_streak,
	p.daily_goal_done, p.daily_goal_date, p.streak, p.accuracy, p.points, p.level,
	p.archetype, p.interests, p.last_active_day, p.deleted_at_ms::text, p.hibernated_at_ms::text,
	p.unlocked_achievements, p.contrarian_wins, p.best_upset_consensus, p.on_fire_streak,
	p.comebacks, p.winning_categories, p.leagues_joined, p.bouts_won, p.leagues_founded,
	p.top_decile_streak, p.last_top_decile_day, p.sharpest_eye_best_tier, p.school_status,
	p.earned_menagerie, p.handle_last_change_ms::text, p.preferences, u.role`;

export const getProfileRow = async ({
	userId,
	q = query
}: {
	userId: string;
	q?: TxQuery;
}): Promise<ProfileRow | undefined> => {
	const rows = await q<ProfileRow>(
		`select ${PROFILE_COLUMNS}
		 from profiles p
		 join users u on u.id = p.user_id
		 where p.user_id = $1`,
		[userId]
	);

	return rows[0];
};

/**
 * Public profile lookup: a soft-deleted or hibernated account is invisible
 * to OTHER callers, but the owner can always read their own (possibly
 * hidden) row, which the client relies on to drive recovery / resume.
 */
export const getProfileView = async ({
	userId,
	callerId
}: {
	userId: string;
	callerId?: string;
}): Promise<Profile | undefined> => {
	const row = await getProfileRow({ userId });

	if (isNullish(row)) {
		return;
	}

	if (isPubliclyHidden(row) && callerId !== userId) {
		return;
	}

	return shapeProfile(row);
};

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** Public search over non-hidden profiles: nickname substring match plus the
 * user id and any linked legacy principal, so imported accounts stay
 * findable by their historic identifier. */
export const searchProfiles = async (queryStr: string): Promise<Profile[]> => {
	const pattern = `%${escapeLike(queryStr.toLowerCase())}%`;

	const rows = await query<ProfileRow>(
		`select ${PROFILE_COLUMNS}
		 from profiles p
		 join users u on u.id = p.user_id
		 where p.deleted_at_ms is null and p.hibernated_at_ms is null
		   and (
		     lower(p.nickname) like $1 escape '\\'
		     or p.user_id::text like $1 escape '\\'
		     or exists (
		       select 1 from legacy_principals lp
		       where lp.user_id = p.user_id and lower(lp.principal) like $1 escape '\\'
		     )
		   )`,
		[pattern]
	);

	return rows.map(shapeProfile);
};

/** Client-writable profile doc (everything but the identity and the role). */
export interface ProfileInput {
	nickname: string;
	avatar: string;
	avatarParts: string;
	email: string;
	pnl: number;
	visibility: ProfileVisibility;
	totalTrades: number;
	winRate: number;
	dailyStreak: number;
	longestStreak: number;
	dailyGoalDone: number;
	dailyGoalDate?: string;
	streak: number;
	accuracy: number;
	points: number;
	level: number;
	archetype: string;
	interests: string[];
	lastActiveDay?: string;
	unlockedAchievements: string[];
	contrarianWins: number;
	bestUpsetConsensus?: number;
	onFireStreak: number;
	comebacks: number;
	winningCategories: number;
	leaguesJoined: number;
	boutsWon: number;
	leaguesFounded: number;
	topDecileStreak: number;
	lastTopDecileDay?: string;
	sharpestEyeBestTier?: string;
	schoolStatus?: string;
	earnedMenagerie?: string[];
	handleLastChangeMs?: number;
	preferences: unknown;
}

const finiteNumber = (value: unknown, field: string, fallback: number): number => {
	if (isNullish(value)) {
		return fallback;
	}

	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new ProfileValidationError(`${field} must be a finite number.`);
	}

	return value;
};

const optionalFiniteNumber = (value: unknown, field: string): number | undefined => {
	if (isNullish(value)) {
		return;
	}

	return finiteNumber(value, field, 0);
};

const stringField = (value: unknown, field: string, fallback: string): string => {
	if (isNullish(value)) {
		return fallback;
	}

	if (typeof value !== 'string') {
		throw new ProfileValidationError(`${field} must be a string.`);
	}

	return value;
};

const optionalString = (value: unknown, field: string): string | undefined => {
	if (isNullish(value)) {
		return;
	}

	return stringField(value, field, '');
};

const stringArray = (value: unknown, field: string): string[] => {
	if (isNullish(value)) {
		return [];
	}

	if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
		throw new ProfileValidationError(`${field} must be an array of strings.`);
	}

	return value as string[];
};

/** Structural validation of the client-sent doc, mirroring the strict
 * profile schema: typed fields, finite numbers, known visibility values. */
export const parseProfileInput = (body: Record<string, unknown>): ProfileInput => {
	const visibility = body.visibility ?? 'friends_only';

	if (!PROFILE_VISIBILITIES.includes(visibility as ProfileVisibility)) {
		throw new ProfileValidationError('visibility must be a known visibility value.');
	}

	return {
		nickname: stringField(body.nickname, 'nickname', ''),
		avatar: stringField(body.avatar, 'avatar', ''),
		avatarParts: stringField(body.avatarParts, 'avatarParts', ''),
		email: stringField(body.email, 'email', ''),
		pnl: finiteNumber(body.pnl, 'pnl', 0),
		visibility: visibility as ProfileVisibility,
		totalTrades: finiteNumber(body.totalTrades, 'totalTrades', 0),
		winRate: finiteNumber(body.winRate, 'winRate', 0),
		dailyStreak: finiteNumber(body.dailyStreak, 'dailyStreak', 0),
		longestStreak: finiteNumber(body.longestStreak, 'longestStreak', 0),
		dailyGoalDone: finiteNumber(body.dailyGoalDone, 'dailyGoalDone', 0),
		dailyGoalDate: optionalString(body.dailyGoalDate, 'dailyGoalDate'),
		streak: finiteNumber(body.streak, 'streak', 0),
		accuracy: finiteNumber(body.accuracy, 'accuracy', 0),
		points: finiteNumber(body.points, 'points', 0),
		level: finiteNumber(body.level, 'level', 1),
		archetype: stringField(body.archetype, 'archetype', ''),
		interests: stringArray(body.interests, 'interests'),
		lastActiveDay: optionalString(body.lastActiveDay, 'lastActiveDay'),
		unlockedAchievements: stringArray(body.unlockedAchievements, 'unlockedAchievements'),
		contrarianWins: finiteNumber(body.contrarianWins, 'contrarianWins', 0),
		bestUpsetConsensus: optionalFiniteNumber(body.bestUpsetConsensus, 'bestUpsetConsensus'),
		onFireStreak: finiteNumber(body.onFireStreak, 'onFireStreak', 0),
		comebacks: finiteNumber(body.comebacks, 'comebacks', 0),
		winningCategories: finiteNumber(body.winningCategories, 'winningCategories', 0),
		leaguesJoined: finiteNumber(body.leaguesJoined, 'leaguesJoined', 0),
		boutsWon: finiteNumber(body.boutsWon, 'boutsWon', 0),
		leaguesFounded: finiteNumber(body.leaguesFounded, 'leaguesFounded', 0),
		topDecileStreak: finiteNumber(body.topDecileStreak, 'topDecileStreak', 0),
		lastTopDecileDay: optionalString(body.lastTopDecileDay, 'lastTopDecileDay'),
		sharpestEyeBestTier: optionalString(body.sharpestEyeBestTier, 'sharpestEyeBestTier'),
		schoolStatus: optionalString(body.schoolStatus, 'schoolStatus'),
		earnedMenagerie: isNullish(body.earnedMenagerie)
			? undefined
			: stringArray(body.earnedMenagerie, 'earnedMenagerie'),
		handleLastChangeMs: optionalFiniteNumber(body.handleLastChangeMs, 'handleLastChangeMs'),
		preferences: body.preferences ?? {}
	};
};

/**
 * Nickname + handle-cooldown write guard, run against the CURRENT stored
 * row inside the upsert transaction. Two concerns:
 *
 * 1. Nickname validity + uniqueness via {@link checkNicknameAvailability},
 *    with a grandfather clause: an unchanged legacy nickname that fails the
 *    charset guard does not block edits to unrelated fields; it is rejected
 *    only when this write actually sets the bad handle.
 * 2. Handle-change cooldown: when the normalized nickname CHANGES versus the
 *    stored row, reject the write while the stored stamp is inside the
 *    window, and otherwise require the proposed stamp to be ~now. When the
 *    nickname is UNCHANGED, the stamp must not move.
 */
const assertValidNickname = async ({
	userId,
	proposed,
	current,
	nowMs,
	q
}: {
	userId: string;
	proposed: ProfileInput;
	current: ProfileRow | undefined;
	nowMs: number;
	q: TxQuery;
}): Promise<void> => {
	const { nickname } = proposed;

	const normalize = (value: string | null | undefined): string => nicknameUniqueKey(value ?? '');

	const settingNewHandle =
		isNullish(current) || normalize(proposed.nickname) !== normalize(current.nickname);

	const result = await checkNicknameAvailability({ nickname, excludeUserId: userId, q });

	if (!result.available) {
		if (result.reason === 'required') {
			throw new ProfileValidationError('Nickname is required.');
		}

		if (result.reason === 'too_short') {
			throw new ProfileValidationError(
				`Nickname must be at least ${MIN_NICKNAME_LENGTH} characters.`
			);
		}

		if (result.reason === 'invalid') {
			// Grandfather an unchanged legacy nickname; reject only when this
			// write actually sets the bad handle.
			if (settingNewHandle) {
				throw new ProfileValidationError(
					`The handle "${nickname}" contains invalid characters: use lowercase letters, numbers and . _ - only (no spaces).`
				);
			}
		} else {
			throw new ProfileValidationError(`The nickname "${nickname}" is already taken.`);
		}
	}

	const proposedLastChangeMs = proposed.handleLastChangeMs;

	// First write (account creation): not a cooldown-gated change. Only guard
	// against a forged future / stale stamp if the client set one at all.
	if (isNullish(current)) {
		if (
			nonNullish(proposedLastChangeMs) &&
			Math.abs(proposedLastChangeMs - nowMs) > HANDLE_LAST_CHANGE_TOLERANCE_MS
		) {
			throw new ProfileValidationError(
				'handleLastChangeMs must be set to the current time on a handle change.'
			);
		}

		return;
	}

	const currentLastChangeMs = nonNullish(current.handle_last_change_ms)
		? Number(current.handle_last_change_ms)
		: undefined;

	if (!settingNewHandle) {
		// Nickname unchanged: the cooldown stamp is immutable. Treat absent on
		// both sides as equal.
		if ((proposedLastChangeMs ?? null) !== (currentLastChangeMs ?? null)) {
			throw new ProfileValidationError(
				'handleLastChangeMs cannot change unless the handle changes.'
			);
		}

		return;
	}

	// Nickname changed: enforce the cooldown against the STORED timestamp.
	const daysLeft = handleCooldownDaysLeft({ lastChangeMs: currentLastChangeMs, nowMs });

	if (daysLeft > 0) {
		throw new ProfileValidationError(
			`The handle was changed recently: it can be changed again in ${daysLeft} day(s).`
		);
	}

	// Allowed change: the proposed doc must stamp the change time to ~now, so
	// the client cannot dodge the next window by under-reporting the change.
	if (
		isNullish(proposedLastChangeMs) ||
		Math.abs(proposedLastChangeMs - nowMs) > HANDLE_LAST_CHANGE_TOLERANCE_MS
	) {
		throw new ProfileValidationError(
			'handleLastChangeMs must be set to the current time on a handle change.'
		);
	}
};

/**
 * Backstop for the server-authoritative Flow daily cap: a direct profile
 * write must not roll the daily counter backward within a day, nor push it
 * past the hard cap. A stale client that re-saves a lower same-day total is
 * rejected so the recorded progress stands; a new-day reset is allowed.
 */
const assertDailyGoalMonotonic = ({
	proposed,
	current
}: {
	proposed: ProfileInput;
	current: ProfileRow | undefined;
}): void => {
	const proposedDone = proposed.dailyGoalDone ?? 0;

	if (!Number.isInteger(proposedDone) || proposedDone < 0) {
		throw new ProfileValidationError('dailyGoalDone must be a non-negative integer.');
	}

	if (proposedDone > DAILY_HARD_CAP) {
		throw new ProfileValidationError(
			`dailyGoalDone cannot exceed the daily hard cap of ${DAILY_HARD_CAP}.`
		);
	}

	if (isNullish(current) || (current.daily_goal_date ?? undefined) !== proposed.dailyGoalDate) {
		return;
	}

	if (proposedDone < (current.daily_goal_done ?? 0)) {
		throw new ProfileValidationError('dailyGoalDone cannot decrease within the same day.');
	}
};

/**
 * Full-doc upsert of the caller's own profile, guarded by the nickname and
 * daily-goal invariants. Runs in one transaction with the stored row locked,
 * so concurrent writes serialize and the guards always compare against the
 * latest committed state; the unique nickname index remains the last-resort
 * backstop for a race on the same fold.
 */
export const upsertMyProfile = async ({
	userId,
	body
}: {
	userId: string;
	body: Record<string, unknown>;
}): Promise<Profile> => {
	const proposed = parseProfileInput(body);
	const nowMs = Date.now();

	return await tx(async (q) => {
		await q(`select 1 from profiles where user_id = $1 for update`, [userId]);

		const current = await getProfileRow({ userId, q });

		await assertValidNickname({ userId, proposed, current, nowMs, q });
		assertDailyGoalMonotonic({ proposed, current });

		try {
			await q(
				`insert into profiles (
				   user_id, nickname, nickname_key, avatar, avatar_parts, email, pnl, visibility,
				   total_trades, win_rate, daily_streak, longest_streak, daily_goal_done,
				   daily_goal_date, streak, accuracy, points, level, archetype, interests,
				   last_active_day, unlocked_achievements, contrarian_wins, best_upset_consensus,
				   on_fire_streak, comebacks, winning_categories, leagues_joined, bouts_won,
				   leagues_founded, top_decile_streak, last_top_decile_day, sharpest_eye_best_tier,
				   school_status, earned_menagerie, handle_last_change_ms, preferences, updated_at
				 ) values (
				   $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
				   $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34,
				   $35, $36, $37, now()
				 )
				 on conflict (user_id) do update set
				   nickname = excluded.nickname,
				   nickname_key = excluded.nickname_key,
				   avatar = excluded.avatar,
				   avatar_parts = excluded.avatar_parts,
				   email = excluded.email,
				   pnl = excluded.pnl,
				   visibility = excluded.visibility,
				   total_trades = excluded.total_trades,
				   win_rate = excluded.win_rate,
				   daily_streak = excluded.daily_streak,
				   longest_streak = excluded.longest_streak,
				   daily_goal_done = excluded.daily_goal_done,
				   daily_goal_date = excluded.daily_goal_date,
				   streak = excluded.streak,
				   accuracy = excluded.accuracy,
				   points = excluded.points,
				   level = excluded.level,
				   archetype = excluded.archetype,
				   interests = excluded.interests,
				   last_active_day = excluded.last_active_day,
				   unlocked_achievements = excluded.unlocked_achievements,
				   contrarian_wins = excluded.contrarian_wins,
				   best_upset_consensus = excluded.best_upset_consensus,
				   on_fire_streak = excluded.on_fire_streak,
				   comebacks = excluded.comebacks,
				   winning_categories = excluded.winning_categories,
				   leagues_joined = excluded.leagues_joined,
				   bouts_won = excluded.bouts_won,
				   leagues_founded = excluded.leagues_founded,
				   top_decile_streak = excluded.top_decile_streak,
				   last_top_decile_day = excluded.last_top_decile_day,
				   sharpest_eye_best_tier = excluded.sharpest_eye_best_tier,
				   school_status = excluded.school_status,
				   earned_menagerie = excluded.earned_menagerie,
				   handle_last_change_ms = excluded.handle_last_change_ms,
				   preferences = excluded.preferences,
				   updated_at = now()`,
				[
					userId,
					proposed.nickname,
					nicknameUniqueKey(proposed.nickname),
					proposed.avatar,
					proposed.avatarParts,
					proposed.email,
					proposed.pnl,
					proposed.visibility,
					proposed.totalTrades,
					proposed.winRate,
					proposed.dailyStreak,
					proposed.longestStreak,
					proposed.dailyGoalDone,
					proposed.dailyGoalDate ?? null,
					proposed.streak,
					proposed.accuracy,
					proposed.points,
					proposed.level,
					proposed.archetype,
					JSON.stringify(proposed.interests),
					proposed.lastActiveDay ?? null,
					JSON.stringify(proposed.unlockedAchievements),
					proposed.contrarianWins,
					proposed.bestUpsetConsensus ?? null,
					proposed.onFireStreak,
					proposed.comebacks,
					proposed.winningCategories,
					proposed.leaguesJoined,
					proposed.boutsWon,
					proposed.leaguesFounded,
					proposed.topDecileStreak,
					proposed.lastTopDecileDay ?? null,
					proposed.sharpestEyeBestTier ?? null,
					proposed.schoolStatus ?? null,
					nonNullish(proposed.earnedMenagerie) ? JSON.stringify(proposed.earnedMenagerie) : null,
					proposed.handleLastChangeMs ?? null,
					JSON.stringify(asRecord(proposed.preferences))
				]
			);
		} catch (err) {
			// The unique nickname index is the backstop for two concurrent
			// first-claims of the same fold; surface it as the same typed error
			// the pre-check produces.
			if (
				typeof err === 'object' &&
				nonNullish(err) &&
				(err as { code?: string }).code === '23505'
			) {
				throw new ProfileValidationError(`The nickname "${proposed.nickname}" is already taken.`);
			}

			throw err;
		}

		const row = await getProfileRow({ userId, q });

		if (isNullish(row)) {
			throw new Error('profile upsert returned no row');
		}

		// League counters ride the same transaction as the profile write: an
		// advance in totalTrades fans the trade/win delta out to every league
		// the user belongs to. Hibernated accounts never move shared stats.
		await fanoutProfileDeltaToLeagueStats({
			q,
			userId,
			before: nonNullish(current)
				? { totalTrades: current.total_trades, winRate: current.win_rate }
				: undefined,
			after: { totalTrades: proposed.totalTrades, winRate: proposed.winRate },
			afterHibernated: nonNullish(row.hibernated_at_ms),
			nowMs
		});

		return shapeProfile(row);
	});
};
