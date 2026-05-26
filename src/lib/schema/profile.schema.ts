import { ProfileVisibility } from '$lib/enums/profile';
import { UserRole } from '$lib/enums/user';
import { j, PrincipalTextSchema } from '@junobuild/schema';

export const UserRoleSchema = j.enum(UserRole);

export const ProfileVisibilitySchema = j.enum(ProfileVisibility);

export const NicknameSchema = j.string();

export const UserProfileSchema = j.strictObject({
	owner: PrincipalTextSchema,
	nickname: NicknameSchema.default(''),
	avatar: j.string().default(''),
	email: j.string().default(''),
	pnl: j.number().default(0),
	visibility: ProfileVisibilitySchema.default(ProfileVisibility.FRIENDS_ONLY),
	role: UserRoleSchema.optional(),
	totalTrades: j.number().default(0),
	winRate: j.number().default(0),
	dailyStreak: j.number().default(0),
	streak: j.number().default(0),
	accuracy: j.number().default(0),
	points: j.number().default(0),
	level: j.number().default(1),
	archetype: j.string().default(''),
	interests: j.array(j.string()).default([]),
	lastActiveDay: j.string().optional(),
	// IDs of achievements the user has ever unlocked (append-only). Source of
	// truth for the achievement system — `evaluateAchievements` re-derives
	// current eligibility on every stats sync, and any newly-true ids are
	// merged in here (with their XP credited to `points`). Unlocks never
	// rescind: if a stat regresses, the achievement stays "earned".
	unlockedAchievements: j.array(j.string()).default([]),
	// Lifetime count of wins on long-shot trades (execution price at or
	// below `CONTRARIAN_PRICE_THRESHOLD`). Drives the `contrarian`
	// achievement progress; recomputed from clearing history during
	// `calculateAndSyncStats`.
	contrarianWins: j.number().default(0),
	// `preferences` carries every cross-device user setting. Defaults are
	// applied at every leaf because the satellite-side encoder traps with
	// `missing field X` the moment `app_list_leaderboard` / `app_get_profile`
	// / `app_search_profiles` encounter a partial `preferences` shape (the
	// inner `strictObject` requires every declared field). Defaulting each
	// leaf lets legacy rows decode cleanly without a data migration. Mirror
	// every change here in `src/satellite/api-schemas.ts`.
	//
	// `defaultAmount` is the wallet-side default-bet preference; the rest
	// of the fields are the user-experience preferences (notifications,
	// flow deck, haptics, saved-markets list) — they migrated off
	// per-device localStorage and now round-trip through the profile so
	// they sync across devices.
	preferences: j
		.strictObject({
			defaultAmount: j
				.strictObject({
					flow: j.string().default('0'),
					manual: j.string().default('0')
				})
				.default({ flow: '0', manual: '0' }),
			notify: j
				.strictObject({
					streakReminder: j.boolean().default(true),
					marketAlerts: j.boolean().default(true),
					friendActivity: j.boolean().default(false),
					weeklyDigest: j.boolean().default(true)
				})
				.default({
					streakReminder: true,
					marketAlerts: true,
					friendActivity: false,
					weeklyDigest: true
				}),
			flowSessionLength: j.number().default(10),
			hapticsEnabled: j.boolean().default(true),
			callsPublic: j.boolean().default(true),
			flowTags: j.array(j.string()).default([]),
			worldCupMode: j.boolean().default(false),
			savedMarketIds: j.array(j.string()).default([])
		})
		.default({
			defaultAmount: { flow: '0', manual: '0' },
			notify: {
				streakReminder: true,
				marketAlerts: true,
				friendActivity: false,
				weeklyDigest: true
			},
			flowSessionLength: 10,
			hapticsEnabled: true,
			callsPublic: true,
			flowTags: [],
			worldCupMode: false,
			savedMarketIds: []
		})
});
