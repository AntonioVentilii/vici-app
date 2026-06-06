import { j, PrincipalTextSchema } from '@junobuild/schema';

/**
 * Runtime mirror of `lib/types/analytics-event.ts`. The two MUST stay in
 * sync — svelte-check validates the TS union, but only this Zod enum
 * guards values at write time (a missing entry fails at runtime, not at
 * type-check). Mirror order matches the type for easy diffing.
 */
export const AnalyticsEventNameSchema = j.enum([
	// Session & auth
	'session_started',
	'signed_up',
	'signed_in',
	'signed_out',
	'provider_linked',
	// Onboarding
	'onboarding_started',
	'onboarding_step',
	'handle_checked',
	'onboarding_completed',
	// Flow
	'flow_session_started',
	'flow_swipe',
	'flow_card_expanded',
	'flow_completed',
	'flow_abandoned',
	'sound_toggled',
	// Markets
	'market_viewed',
	'market_searched',
	'market_shared',
	'watchlist_added',
	'watchlist_removed',
	'orderbook_viewed',
	// Trading
	'position_taken',
	'position_closed',
	'prediction_created',
	'order_placed',
	'order_cancelled',
	// Resolution & payout
	'resolution_proposed',
	'resolution_confirmed',
	'resolution_disputed',
	'payout_settled',
	// Referral
	'referral_sent',
	'referral_link_copied',
	'referral_redeemed',
	'referral_converted',
	// VXP & economy
	'vxp_awarded',
	'streak_milestone',
	'faucet_claimed',
	// Social & leagues
	'league_created',
	'league_joined',
	'league_invite_sent',
	'battle_proposed',
	'battle_accepted',
	'battle_resolved',
	'comment_posted',
	'chat_sent',
	// Worlds
	'affiliation_set',
	'affiliation_removed',
	// School verification
	'school_picker_opened',
	'school_picked',
	'school_verify_email_submitted',
	'school_verify_code_submitted',
	// Churn
	'delete_flow_opened',
	'delete_confirmed',
	'delete_succeeded',
	'exit_signal',
	// Health
	'app_error',
	'perf_metric'
]);

/**
 * Bounded dimensional vocabulary — mirrors `AnalyticsEventProps`. Fixed,
 * primitive, optional fields only; never widen to an open record (keeps
 * "no PII" structural).
 */
export const AnalyticsEventPropsSchema = j.strictObject({
	marketId: j.optional(j.string()),
	seriesId: j.optional(j.string()),
	leagueId: j.optional(j.string()),
	battleId: j.optional(j.string()),
	source: j.optional(j.string()),
	variant: j.optional(j.string()),
	step: j.optional(j.number()),
	value: j.optional(j.number()),
	count: j.optional(j.number()),
	durationMs: j.optional(j.number()),
	ok: j.optional(j.boolean())
});

/**
 * Persisted shape for entries in the `events` collection. Mirrors
 * `AnalyticsEventDoc`. Written server-side after validation.
 */
export const AnalyticsEventSchema = j.strictObject({
	name: AnalyticsEventNameSchema,
	tsMs: j.number(),
	sessionId: j.string(),
	principal: j.optional(PrincipalTextSchema),
	path: j.optional(j.string()),
	props: j.optional(AnalyticsEventPropsSchema)
});
