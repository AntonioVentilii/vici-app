import { j, PrincipalTextSchema } from '@junobuild/schema';

/**
 * Persisted shape for entries in the `vxp_awards` collection. Mirrors
 * `lib/types/vxp-award.ts`. Wire / persisted format matches the type
 * 1:1 — no snake_case dance because no Rust-side codegen reads this.
 */
export const VxpAwardTypeSchema = j.enum([
	'streak',
	'calibration',
	'referral',
	'worlds_podium',
	'tournament_prize',
	'achievement',
	'comeback',
	'flow_milestone',
	'flow_overtime'
]);

export const VxpAwardStatusSchema = j.enum(['pending', 'paid', 'failed']);

export const VxpAwardSchema = j.strictObject({
	recipient: PrincipalTextSchema,
	awardType: VxpAwardTypeSchema,
	awardKey: j.string(),
	amountBaseUnits: j.string(),
	status: VxpAwardStatusSchema,
	earnedAtMs: j.number(),
	paidAtMs: j.optional(j.number()),
	blockIndex: j.optional(j.string()),
	errorMessage: j.optional(j.string())
});
