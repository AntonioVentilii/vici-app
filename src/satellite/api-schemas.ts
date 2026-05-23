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
	// Defaults are intentionally applied at every level (not just on the
	// outer `preferences`). The outer `.default(...)` only kicks in when
	// `preferences` is null/undefined; legacy profile docs that have
	// `preferences: {}` or a partial `preferences` shape would still trap
	// during JsonData→Candid encoding with `missing field default_amount`
	// because the inner `strictObject` requires every declared field.
	// Defaulting `flow` / `manual` and the `defaultAmount` record itself
	// lets those rows decode cleanly without a data migration. Mirror any
	// change here in `src/lib/schema/profile.schema.ts`.
	preferences: j
		.strictObject({
			defaultAmount: j
				.strictObject({
					flow: j.string().default('0'),
					manual: j.string().default('0')
				})
				.default({ flow: '0', manual: '0' })
		})
		.default({ defaultAmount: { flow: '0', manual: '0' } })
});

export const RelationApiSchema = j.strictObject({
	category: j.enum(RelationCategory),
	state: j.enum(RelationState),
	participants: j.array(PrincipalTextSchema),
	viewerPrincipal: PrincipalTextSchema.optional(),
	viewerRole: j.string().optional(),
	isFriend: j.boolean().optional()
});
