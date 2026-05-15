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
	preferences: j
		.strictObject({
			defaultAmount: j.strictObject({
				flow: j.string(),
				manual: j.string()
			})
		})
		.optional()
});
