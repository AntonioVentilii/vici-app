/**
 * Satellite API-compatible schemas.
 *
 * The Juno Sputnik JsonData derive macro cannot handle:
 *  - Option<Enum>   with #[json_data(nested)]
 *  - Option<Struct> with #[json_data(nested)]
 *
 * These schemas mirror the app-level schemas but replace optional enums with
 * optional strings and make optional nested objects non-optional (with defaults)
 * so the generated Rust code compiles to WASM.
 */
import { ProfileVisibility } from '$lib/enums/profile';
import { RelationCategory, RelationState } from '$lib/enums/relation';
import { j, PrincipalTextSchema } from '@junobuild/schema';

export const UserProfileApiSchema = j.strictObject({
	owner: PrincipalTextSchema,
	nickname: j.string().default(''),
	avatar: j.string().default(''),
	pnl: j.number().default(0),
	visibility: j.enum(ProfileVisibility).default(ProfileVisibility.FRIENDS_ONLY),
	role: j.string().optional(),
	totalTrades: j.number().default(0),
	winRate: j.number().default(0),
	dailyStreak: j.number().default(0),
	streak: j.number().default(0),
	accuracy: j.number().default(0),
	points: j.number().default(0),
	level: j.number().default(1),
	interests: j.array(j.string()).default([]),
	lastActiveDay: j.string().optional(),
	createdAt: j.number().default(() => Date.now()),
	updatedAt: j.number().default(() => Date.now()),
	preferences: j
		.strictObject({
			defaultAmount: j.strictObject({
				flow: j.string(),
				manual: j.string()
			})
		})
		.default({ defaultAmount: { flow: '0', manual: '0' } })
});

export const RelationApiSchema = j.strictObject({
	category: j.enum(RelationCategory),
	state: j.enum(RelationState),
	participants: j.array(PrincipalTextSchema),
	viewerPrincipal: PrincipalTextSchema.optional(),
	viewerRole: j.string().optional(),
	isFriend: j.boolean().optional(),
	createdAt: j.number(),
	updatedAt: j.number()
});
