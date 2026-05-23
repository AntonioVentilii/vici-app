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
	preferences: j
		.strictObject({
			defaultAmount: j.strictObject({
				flow: j.string(),
				manual: j.string()
			})
		})
		.optional()
});
