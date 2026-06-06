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
	label: j.optional(j.string()),
	step: j.optional(j.number()),
	value: j.optional(j.number()),
	count: j.optional(j.number()),
	durationMs: j.optional(j.number()),
	ok: j.optional(j.boolean())
});

/**
 * Persisted shape for entries in the `events` collection. Mirrors
 * `AnalyticsEventDoc`. Written server-side after validation.
 *
 * NB: `principal` is one of `@junobuild/schema`'s reserved field names —
 * fine here because this schema is decoded/encoded by hand and is NOT a
 * `defineQuery` / `defineUpdate` signature (the codegen never sees it).
 */
export const AnalyticsEventSchema = j.strictObject({
	name: AnalyticsEventNameSchema,
	tsMs: j.number(),
	sessionId: j.string(),
	principal: j.optional(PrincipalTextSchema),
	path: j.optional(j.string()),
	props: j.optional(AnalyticsEventPropsSchema)
});

/**
 * Args for the `trackEvents` update endpoint — a batch of client events.
 * The server derives identity + timestamp, so the input carries neither.
 *
 * The `AnalyticsEventProps` dimensions are **flattened** onto the input
 * rather than nested: the Sputnik codegen rejects a nested optional object
 * inside an array element ("Error generating API"), so the wire shape stays
 * one level deep. The satellite re-nests these into `props` before storage.
 */
export const TrackEventInputSchema = j.strictObject({
	name: AnalyticsEventNameSchema,
	sessionId: j.string(),
	path: j.optional(j.string()),
	marketId: j.optional(j.string()),
	seriesId: j.optional(j.string()),
	leagueId: j.optional(j.string()),
	battleId: j.optional(j.string()),
	source: j.optional(j.string()),
	// `label`, not `variant`: `variant` is a Candid reserved keyword and
	// breaks the Sputnik API codegen ("Error generating API").
	label: j.optional(j.string()),
	step: j.optional(j.number()),
	value: j.optional(j.number()),
	count: j.optional(j.number()),
	durationMs: j.optional(j.number()),
	ok: j.optional(j.boolean()),
	occurredAtMs: j.optional(j.number())
});

export const TrackEventsArgsSchema = j.strictObject({
	events: j.array(TrackEventInputSchema)
});

export const TrackEventsResultSchema = j.strictObject({
	accepted: j.number()
});

/** Args for `getAnalyticsSummary` — how many trailing days of rollups to return. */
export const GetAnalyticsSummaryArgsSchema = j.strictObject({
	days: j.number()
});

/**
 * Result of `getAnalyticsSummary` — a **flat** list of `(day, name, count)`
 * rows (the cockpit groups by `day` client-side). Kept single-level: the
 * codegen rejects an array nested inside another array's record. `day` is
 * the epoch-day index and `start` its start-of-day ms.
 */
export const AnalyticsSummarySchema = j.strictObject({
	rows: j.array(
		j.strictObject({
			day: j.number(),
			start: j.number(),
			name: AnalyticsEventNameSchema,
			count: j.number()
		})
	)
});
