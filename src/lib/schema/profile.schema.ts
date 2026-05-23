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
	// `preferences` is optional at the top level, but the inner fields are
	// also given defaults on purpose. Some profile docs in storage predate
	// the `defaultAmount` field (or were written with a partial
	// `preferences` shape from an older client). Without nested defaults,
	// the satellite-side encoder traps with `missing field default_amount`
	// the moment `app_list_leaderboard` / `app_get_profile` /
	// `app_search_profiles` encounter such a row, because `strictObject`
	// requires every declared field. Defaulting `flow` / `manual` (and the
	// `defaultAmount` record itself) lets legacy rows decode cleanly without
	// a data migration. Mirror any change here in
	// `src/satellite/api-schemas.ts`.
	preferences: j
		.strictObject({
			defaultAmount: j
				.strictObject({
					flow: j.string().default('0'),
					manual: j.string().default('0')
				})
				.default({ flow: '0', manual: '0' })
		})
		.optional()
});
