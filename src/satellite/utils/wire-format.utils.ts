import { ProfileVisibility } from '$lib/enums/profile';
import { RelationCategory, RelationState } from '$lib/enums/relation';
import { UserRole } from '$lib/enums/user';
import type { MarketTranslation } from '$lib/types/market-translation';
import type { UserProfile } from '$lib/types/profile';
import type { ReferralListItem } from '$lib/types/referral';
import type { VxpMilestoneState } from '$lib/types/vxp-onboarding';
import { visibilityFromProfile } from '$lib/utils/visibility.utils';
import { j, PrincipalTextSchema } from '@junobuild/schema';

/**
 * Snake_case wire-format schemas + converters for Sputnik typed queries
 * that return arrays of nested structs.
 *
 * # Background
 *
 * Juno's Sputnik codegen always emits Rust struct fields in snake_case and
 * the `JsonData` derive macro normally builds a mirror struct with
 * `#[serde(rename_all = "camelCase")]` so the JSON↔Rust handoff uses
 * camelCase on the wire. But that mirror only wraps fields explicitly
 * marked `#[json_data(nested)]`, and the codegen does **not** add that
 * attribute to `Vec<NestedStruct>` fields. For example:
 *
 * ```rust
 * // ✅ getProfile — `profile` IS nested, so wire format is camelCase
 * pub struct AppGetProfileResult {
 *     #[json_data(nested)]
 *     pub profile: Option<AppGetProfileResultProfile>,
 * }
 *
 * // ❌ listLeaderboard — `items` is NOT nested, so the wire format reverts
 * //   to the inner struct's original `Deserialize` impl which has no
 * //   rename_all attribute — i.e. snake_case.
 * pub struct AppListLeaderboardResult {
 *     pub items: Vec<AppListLeaderboardResultItems>,
 * }
 * ```
 *
 * Every `Vec<…Items>` endpoint therefore expects snake_case keys on the
 * wire, but our app-side schemas (e.g. `UserProfileSchema`) declare camelCase
 * keys (matching the TypeScript app convention). Without intervention the
 * `JsonData → Candid` deserializer traps on every read with
 * `'Error converting from js JsonData into type Candid: missing field
 * <snake_case_name>'`.
 *
 * # Why the schemas below are duplicated
 *
 * We can't fix this with `.transform()` on the result schema — that produces
 * a `ZodEffects`, and juno's schema → Rust codegen only accepts `ZodObject`
 * (it fails with "Unsupported type: unrepresentable schema" and the whole
 * `juno functions build` exits silently with code 1).
 *
 * Instead, each `Vec<NestedStruct>` endpoint uses a parallel **wire
 * schema** declared here in snake_case. juno's codegen reads the declared
 * field names verbatim, the Rust struct is byte-identical to before, and the
 * runtime handler emits snake_case via the matching `toWire…` converter so
 * Zod parse succeeds with the same shape it then serializes to JSON.
 *
 * # When to apply
 *
 * Apply on **every** `j.array(NestedStruct)` result. For `Option<NestedStruct>`
 * endpoints (e.g. `getProfile`'s `profile`) the wire is already camelCase via
 * the `#[json_data(nested)]` mirror — keep those camelCase as-is.
 */

// ─── UserProfile wire format ─────────────────────────────────────────────

export const UserProfileWireSchema = j.strictObject({
	owner: PrincipalTextSchema,
	nickname: j.string().default(''),
	avatar: j.string().default(''),
	email: j.string().default(''),
	pnl: j.number().default(0),
	visibility: j.enum(ProfileVisibility).default(ProfileVisibility.FRIENDS_ONLY),
	role: j.enum(UserRole).optional(),
	total_trades: j.number().default(0),
	win_rate: j.number().default(0),
	daily_streak: j.number().default(0),
	streak: j.number().default(0),
	accuracy: j.number().default(0),
	points: j.number().default(0),
	level: j.number().default(1),
	archetype: j.string().default(''),
	interests: j.array(j.string()).default([]),
	last_active_day: j.string().optional(),
	unlocked_achievements: j.array(j.string()).default([]),
	contrarian_wins: j.number().default(0),
	preferences: j
		.strictObject({
			default_amount: j
				.strictObject({
					flow: j.string().default('0'),
					manual: j.string().default('0')
				})
				.default({ flow: '0', manual: '0' })
		})
		.optional()
});

export type WireUserProfile = j.infer<typeof UserProfileWireSchema>;

// Local TS shape this converter accepts — exactly mirrors UserProfile from
// `src/lib/types/profile.ts`. Kept inline (instead of importing UserProfile)
// so a future divergence of either shape doesn't silently break the wire.
interface AppProfileLike {
	owner: string;
	nickname?: string;
	avatar?: string;
	email?: string;
	pnl?: number;
	visibility: WireUserProfile['visibility'];
	role?: WireUserProfile['role'];
	totalTrades?: number;
	winRate?: number;
	dailyStreak?: number;
	streak?: number;
	accuracy?: number;
	points?: number;
	level?: number;
	archetype?: string;
	interests?: string[];
	lastActiveDay?: string;
	unlockedAchievements?: string[];
	contrarianWins?: number;
	preferences?: { defaultAmount?: { flow?: string; manual?: string } };
}

export const toWireProfile = (profile: AppProfileLike): WireUserProfile => ({
	owner: profile.owner,
	nickname: profile.nickname ?? '',
	avatar: profile.avatar ?? '',
	email: profile.email ?? '',
	pnl: profile.pnl ?? 0,
	visibility: profile.visibility,
	role: profile.role,
	total_trades: profile.totalTrades ?? 0,
	win_rate: profile.winRate ?? 0,
	daily_streak: profile.dailyStreak ?? 0,
	streak: profile.streak ?? 0,
	accuracy: profile.accuracy ?? 0,
	points: profile.points ?? 0,
	level: profile.level ?? 1,
	archetype: profile.archetype ?? '',
	interests: profile.interests ?? [],
	last_active_day: profile.lastActiveDay,
	unlocked_achievements: profile.unlockedAchievements ?? [],
	contrarian_wins: profile.contrarianWins ?? 0,
	preferences: profile.preferences
		? {
				default_amount: {
					flow: profile.preferences.defaultAmount?.flow ?? '0',
					manual: profile.preferences.defaultAmount?.manual ?? '0'
				}
			}
		: undefined
});

/**
 * Wire-format profile as produced by the generated satellite API client
 * (`src/declarations/satellite/satellite.api.ts`). The codegen emits
 * `visibility` / `role` as string-literal unions rather than as the
 * `ProfileVisibility` / `UserRole` enum types used by {@link UserProfileWireSchema},
 * even though the runtime strings are identical. We mirror that exact
 * structural shape here so {@link fromWireProfile} can consume both the
 * generated-API output and any in-process value that satisfies
 * {@link WireUserProfile}.
 */
export interface ApiWireProfile {
	owner: string;
	nickname: string;
	avatar: string;
	email: string;
	pnl: number;
	visibility: `${ProfileVisibility}`;
	role?: `${UserRole}`;
	total_trades: number;
	win_rate: number;
	daily_streak: number;
	streak: number;
	accuracy: number;
	points: number;
	level: number;
	archetype: string;
	interests: string[];
	last_active_day?: string;
	unlocked_achievements: string[];
	contrarian_wins: number;
	preferences?: {
		default_amount: { flow: string; manual: string };
	};
}

/**
 * Inverse of {@link toWireProfile}. Re-camelCases a row coming back from a
 * satellite query whose `result` schema uses {@link UserProfileWireSchema}
 * (i.e. every `j.array(UserProfileWireSchema)` endpoint —
 * `listLeaderboard`, `searchProfiles`, …). Frontend callers should funnel
 * wire items through this before handing them to UI / stores typed as
 * {@link UserProfile}.
 */
export const fromWireProfile = (profile: ApiWireProfile): UserProfile => ({
	owner: profile.owner,
	nickname: profile.nickname,
	avatar: profile.avatar,
	email: profile.email,
	pnl: profile.pnl,
	visibility: profile.visibility as ProfileVisibility,
	role: profile.role as UserRole | undefined,
	totalTrades: profile.total_trades,
	winRate: profile.win_rate,
	dailyStreak: profile.daily_streak,
	// Daily goal isn't carried on the leaderboard / search wire (those
	// surfaces don't read it), so default it like the other non-wire
	// fields below to keep the rebuilt UserProfile fully shaped.
	dailyGoalDone: 0,
	streak: profile.streak,
	accuracy: profile.accuracy,
	points: profile.points,
	level: profile.level,
	archetype: profile.archetype,
	interests: profile.interests,
	lastActiveDay: profile.last_active_day,
	unlockedAchievements: profile.unlocked_achievements,
	contrarianWins: profile.contrarian_wins,
	// Top-decile streak state isn't carried on the leaderboard / search
	// wire (those surfaces don't read it), so default it like the other
	// non-wire fields below to keep the rebuilt UserProfile fully shaped.
	topDecileStreak: 0,
	// The wire format only carries `default_amount` — the leaderboard /
	// search endpoints don't read the user-experience preferences
	// (`notify`, `flowTags`, `savedMarketIds`, etc.), so they're not
	// round-tripped on this path. Default the rest to the schema's
	// initial values so the rebuilt UserProfile is fully shaped.
	preferences: {
		defaultAmount: {
			flow: profile.preferences?.default_amount?.flow ?? '0',
			manual: profile.preferences?.default_amount?.manual ?? '0'
		},
		notify: {
			streakReminder: true,
			marketAlerts: true,
			friendActivity: false,
			weeklyDigest: true
		},
		flowSessionLength: 10,
		hapticsEnabled: true,
		soundEnabled: true,
		sharing: {
			// Derive from the canonical top-level `visibility` so the settings
			// source-of-truth slice agrees with the real visibility on this
			// wire profile (FRIENDS_ONLY → 'private') instead of hard-coding it.
			profileVisibility: visibilityFromProfile(profile.visibility as ProfileVisibility),
			callsPublic: true,
			leaderboardOptIn: true,
			worldsOptIn: true
		},
		flowTags: [],
		worldCupMode: false,
		savedMarketIds: [],
		favoriteParticipantId: '',
		favoriteSide: '',
		onboardingCompleted: false
	}
});

// ─── Relation wire format ────────────────────────────────────────────────

export const RelationWireSchema = j.strictObject({
	category: j.enum(RelationCategory),
	state: j.enum(RelationState),
	participants: j.array(PrincipalTextSchema),
	viewer_principal: PrincipalTextSchema.optional(),
	viewer_role: j.enum(UserRole).optional(),
	is_friend: j.boolean().optional()
});

export type WireRelation = j.infer<typeof RelationWireSchema>;

interface AppRelationLike {
	category: WireRelation['category'];
	state: WireRelation['state'];
	participants: string[];
	viewerPrincipal?: string;
	viewerRole?: WireRelation['viewer_role'];
	isFriend?: boolean;
}

export const toWireRelation = (relation: AppRelationLike): WireRelation => ({
	category: relation.category,
	state: relation.state,
	participants: relation.participants,
	viewer_principal: relation.viewerPrincipal,
	viewer_role: relation.viewerRole,
	is_friend: relation.isFriend
});

// ─── MarketTranslation wire format ───────────────────────────────────────

export const OutcomeTranslationWireSchema = j.strictObject({
	id: j.string(),
	title: j.string()
});

export const MarketTranslationWireSchema = j.strictObject({
	series_id: j.string(),
	locale: j.string(),
	title: j.string(),
	description: j.string(),
	outcomes: j.array(OutcomeTranslationWireSchema).default([]),
	updated_at: j.number(),
	updated_by: PrincipalTextSchema
});

export type WireMarketTranslation = j.infer<typeof MarketTranslationWireSchema>;

interface AppMarketTranslationLike {
	seriesId: string;
	locale: string;
	title: string;
	description: string;
	outcomes?: { id: string; title: string }[];
	updatedAt: number;
	updatedBy: string;
}

export const toWireMarketTranslation = (
	translation: AppMarketTranslationLike
): WireMarketTranslation => ({
	series_id: translation.seriesId,
	locale: translation.locale,
	title: translation.title,
	description: translation.description,
	outcomes: translation.outcomes ?? [],
	updated_at: translation.updatedAt,
	updated_by: translation.updatedBy
});

/**
 * Inverse of {@link toWireMarketTranslation}. Used by frontend services
 * consuming `listMarketTranslations` (which returns
 * `j.array(MarketTranslationWireSchema)`) so the items land typed as
 * {@link MarketTranslation}.
 */
export const fromWireMarketTranslation = (
	translation: WireMarketTranslation
): MarketTranslation => ({
	seriesId: translation.series_id,
	locale: translation.locale,
	title: translation.title,
	description: translation.description,
	outcomes: translation.outcomes,
	updatedAt: translation.updated_at,
	updatedBy: translation.updated_by
});

// ─── Referral wire format ────────────────────────────────────────────────

const VxpMilestoneStateWireSchema = j.strictObject({
	status: j.enum(['none', 'owed', 'processing', 'paid']),
	amount_base_units: j.string(),
	block_index: j.string().optional(),
	last_error: j.string().optional()
});

export const ReferralWireSchema = j.strictObject({
	referee: PrincipalTextSchema,
	referrer: PrincipalTextSchema,
	code: j.string(),
	redeemed_at_ms: j.number(),
	within_referrer_cap: j.boolean(),
	referee_payout: VxpMilestoneStateWireSchema,
	referrer_payout: VxpMilestoneStateWireSchema
});

export type WireReferral = j.infer<typeof ReferralWireSchema>;
export type WireVxpMilestoneState = j.infer<typeof VxpMilestoneStateWireSchema>;

const toWireMilestone = (state: VxpMilestoneState): WireVxpMilestoneState => ({
	status: state.status,
	amount_base_units: state.amountBaseUnits,
	block_index: state.blockIndex,
	last_error: state.lastError
});

export const toWireReferral = (referral: ReferralListItem): WireReferral => ({
	referee: referral.referee,
	referrer: referral.referrer,
	code: referral.code,
	redeemed_at_ms: referral.redeemedAtMs,
	within_referrer_cap: referral.withinReferrerCap,
	referee_payout: toWireMilestone(referral.refereePayout),
	referrer_payout: toWireMilestone(referral.referrerPayout)
});

/**
 * Wire-format referral as produced by the generated satellite API client. Mirrors
 * {@link ReferralWireSchema} structurally but keeps `status` as a string-literal union
 * (matching the codegen output) so {@link fromWireReferral} accepts both in-process
 * {@link WireReferral} values and freshly-fetched API rows.
 */
export interface ApiWireReferral {
	referee: string;
	referrer: string;
	code: string;
	redeemed_at_ms: number;
	within_referrer_cap: boolean;
	referee_payout: {
		status: 'none' | 'owed' | 'processing' | 'paid';
		amount_base_units: string;
		block_index?: string;
		last_error?: string;
	};
	referrer_payout: {
		status: 'none' | 'owed' | 'processing' | 'paid';
		amount_base_units: string;
		block_index?: string;
		last_error?: string;
	};
}

const fromWireMilestone = (state: ApiWireReferral['referee_payout']): VxpMilestoneState => ({
	status: state.status,
	amountBaseUnits: state.amount_base_units,
	blockIndex: state.block_index,
	lastError: state.last_error
});

/**
 * Inverse of {@link toWireReferral}. Frontend callers funnel `listMyReferrals` items
 * through this so the UI consumes camelCase {@link ReferralListItem} values.
 */
export const fromWireReferral = (referral: ApiWireReferral): ReferralListItem => ({
	version: 1,
	referee: referral.referee,
	referrer: referral.referrer,
	code: referral.code,
	redeemedAtMs: referral.redeemed_at_ms,
	withinReferrerCap: referral.within_referrer_cap,
	refereePayout: fromWireMilestone(referral.referee_payout),
	referrerPayout: fromWireMilestone(referral.referrer_payout)
});

// ─── Leagues ────────────────────────────────────────────────────
// Wire schemas use snake_case per the juno codegen constraint on
// `Vec<NestedStruct>` (see UserProfileWireSchema header). FE callers
// hit `fromWireLeague` / `fromWireLeagueMember` to project back to
// the camelCase domain types.

export const LeagueWireSchema = j.strictObject({
	id: j.string(),
	name: j.string(),
	description: j.string().optional(),
	invite_code: j.string(),
	owner: PrincipalTextSchema,
	created_at_ms: j.number(),
	accent_color: j.string().optional(),
	emblem: j.string().optional(),
	private: j.boolean().default(false)
});

export type WireLeague = j.infer<typeof LeagueWireSchema>;

export const LeagueWithRoleWireSchema = j.strictObject({
	league: LeagueWireSchema,
	role: j.enum(['owner', 'admin', 'member']),
	joined_at_ms: j.number(),
	member_count: j.number().default(1)
});

export type WireLeagueWithRole = j.infer<typeof LeagueWithRoleWireSchema>;

export const LeagueMemberWireSchema = j.strictObject({
	league_id: j.string(),
	member: PrincipalTextSchema,
	joined_at_ms: j.number(),
	role: j.enum(['owner', 'admin', 'member'])
});

export type WireLeagueMember = j.infer<typeof LeagueMemberWireSchema>;

export const toWireLeague = (league: {
	id: string;
	name: string;
	description?: string;
	inviteCode: string;
	owner: string;
	createdAtMs: number;
	accentColor?: string;
	emblem?: string;
	private?: boolean;
}): WireLeague => ({
	id: league.id,
	name: league.name,
	description: league.description,
	invite_code: league.inviteCode,
	owner: league.owner,
	created_at_ms: league.createdAtMs,
	accent_color: league.accentColor,
	emblem: league.emblem,
	private: league.private ?? false
});

export const toWireLeagueWithRole = (entry: {
	league: Parameters<typeof toWireLeague>[0];
	role: 'owner' | 'admin' | 'member';
	joinedAtMs: number;
	memberCount: number;
}): WireLeagueWithRole => ({
	league: toWireLeague(entry.league),
	role: entry.role,
	joined_at_ms: entry.joinedAtMs,
	member_count: entry.memberCount
});

export const toWireLeagueMember = (member: {
	leagueId: string;
	member: string;
	joinedAtMs: number;
	role: 'owner' | 'admin' | 'member';
}): WireLeagueMember => ({
	league_id: member.leagueId,
	member: member.member,
	joined_at_ms: member.joinedAtMs,
	role: member.role
});

// ─── Battles ──────────────────────────────────────────────────────

export const BattleWireSchema = j.strictObject({
	id: j.string(),
	kind: j.enum(['league', 'duel']),
	side_a: j.string(),
	side_b: j.string(),
	proposer: PrincipalTextSchema,
	state: j.enum(['proposed', 'accepted', 'in_flight', 'resolved']),
	kickoff_ms: j.number(),
	settle_ms: j.number(),
	// Scope is a loose string on the wire (not a j.enum) so legacy rows
	// without the field, and any future category tag, decode without a
	// migration. The FE re-narrows via `isBattleScope`.
	scope: j.string().optional(),
	wager: j.number().optional(),
	trash_talk: j.string().optional(),
	score_a: j.number().optional(),
	score_b: j.number().optional(),
	winner: j.enum(['A', 'B', 'draw']).optional()
});

export type WireBattle = j.infer<typeof BattleWireSchema>;

export const toWireBattle = (battle: {
	id: string;
	kind: 'league' | 'duel';
	sideA: string;
	sideB: string;
	proposer: string;
	state: 'proposed' | 'accepted' | 'in_flight' | 'resolved';
	kickoffMs: number;
	settleMs: number;
	scope?: string;
	wager?: number;
	trashTalk?: string;
	scoreA?: number;
	scoreB?: number;
	winner?: 'A' | 'B' | 'draw';
}): WireBattle => ({
	id: battle.id,
	kind: battle.kind,
	side_a: battle.sideA,
	side_b: battle.sideB,
	proposer: battle.proposer,
	state: battle.state,
	kickoff_ms: battle.kickoffMs,
	settle_ms: battle.settleMs,
	scope: battle.scope,
	wager: battle.wager,
	trash_talk: battle.trashTalk,
	score_a: battle.scoreA,
	score_b: battle.scoreB,
	winner: battle.winner
});

// ─── Affiliations ───────────────────────────────────────────────

// Snake_case shape used for `j.array(...)` endpoints
// (`listWorldsRoster`). Vec items don't get the `#[json_data(nested)]`
// wrapper, so the inner JSON deserializer reads the Rust struct's
// literal (snake_case) field names — see the file-level docstring.
export const AffiliationWireSchema = j.strictObject({
	member: PrincipalTextSchema,
	kind: j.enum(['university', 'country']),
	affiliation_identifier: j.string(),
	joined_at_ms: j.number(),
	locked_until_ms: j.number()
});

export type WireAffiliation = j.infer<typeof AffiliationWireSchema>;

export const toWireAffiliation = (aff: {
	member: string;
	kind: 'university' | 'country';
	affiliationIdentifier: string;
	joinedAtMs: number;
	lockedUntilMs: number;
}): WireAffiliation => ({
	member: aff.member,
	kind: aff.kind,
	affiliation_identifier: aff.affiliationIdentifier,
	joined_at_ms: aff.joinedAtMs,
	locked_until_ms: aff.lockedUntilMs
});

// camelCase shape required by `j.optional(...)` endpoints
// (`listMyAffiliations`). Option nested structs get
// `#[json_data(nested)]` which routes through the JsonData mirror
// — that mirror is generated with `#[serde(rename_all = "camelCase")]`,
// so the JS payload must use camelCase keys or
// `from_json_data` traps with `missing field <camelCaseName>`. The
// schema field names match the in-memory `AffiliationDoc` shape so
// handlers can return the projected doc directly without a `toWire`
// step.
export const AffiliationOptionWireSchema = j.strictObject({
	member: PrincipalTextSchema,
	kind: j.enum(['university', 'country']),
	affiliationIdentifier: j.string(),
	joinedAtMs: j.number(),
	lockedUntilMs: j.number()
});

export type OptionWireAffiliation = j.infer<typeof AffiliationOptionWireSchema>;

// ─── Affiliation stats ──────────────────────────────────────────────

// Snake_case shape for `j.array(...)` endpoints
// (`listAffiliationStats`).
export const AffiliationStatsWireSchema = j.strictObject({
	affiliation_identifier: j.string(),
	kind: j.enum(['university', 'country']),
	total_calls: j.number(),
	wins: j.number(),
	month_anchor: j.string(),
	month_total_calls: j.number(),
	month_wins: j.number(),
	updated_at_ms: j.number()
});

export type WireAffiliationStats = j.infer<typeof AffiliationStatsWireSchema>;

export const toWireAffiliationStats = (stats: {
	affiliationIdentifier: string;
	kind: 'university' | 'country';
	totalCalls: number;
	wins: number;
	monthAnchor: string;
	monthTotalCalls: number;
	monthWins: number;
	updatedAtMs: number;
}): WireAffiliationStats => ({
	affiliation_identifier: stats.affiliationIdentifier,
	kind: stats.kind,
	total_calls: stats.totalCalls,
	wins: stats.wins,
	month_anchor: stats.monthAnchor,
	month_total_calls: stats.monthTotalCalls,
	month_wins: stats.monthWins,
	updated_at_ms: stats.updatedAtMs
});

// camelCase shape for `j.optional(...)` (`getAffiliationStats`).
export const AffiliationStatsOptionWireSchema = j.strictObject({
	affiliationIdentifier: j.string(),
	kind: j.enum(['university', 'country']),
	totalCalls: j.number(),
	wins: j.number(),
	monthAnchor: j.string(),
	monthTotalCalls: j.number(),
	monthWins: j.number(),
	updatedAtMs: j.number()
});

export type OptionWireAffiliationStats = j.infer<typeof AffiliationStatsOptionWireSchema>;

// Per-affiliation real member tally, snake_case for the
// `j.array(...)` member-count endpoint.
export const AffiliationMemberCountWireSchema = j.strictObject({
	affiliation_identifier: j.string(),
	kind: j.enum(['university', 'country']),
	member_count: j.number()
});

export type WireAffiliationMemberCount = j.infer<typeof AffiliationMemberCountWireSchema>;

export const toWireAffiliationMemberCount = (count: {
	affiliationIdentifier: string;
	kind: 'university' | 'country';
	memberCount: number;
}): WireAffiliationMemberCount => ({
	affiliation_identifier: count.affiliationIdentifier,
	kind: count.kind,
	member_count: count.memberCount
});

// A past month an affiliation finished first in its kind, snake_case
// for the `j.array(...)` champion-history endpoint.
export const AffiliationChampionshipWireSchema = j.strictObject({
	month_anchor: j.string(),
	accuracy: j.number(),
	month_total_calls: j.number()
});

export type WireAffiliationChampionship = j.infer<typeof AffiliationChampionshipWireSchema>;

export const toWireAffiliationChampionship = (cup: {
	monthAnchor: string;
	accuracy: number;
	monthTotalCalls: number;
}): WireAffiliationChampionship => ({
	month_anchor: cup.monthAnchor,
	accuracy: cup.accuracy,
	month_total_calls: cup.monthTotalCalls
});

// ─── Tournament + matches ───────────────────────────────────────────

export const TournamentWireSchema = j.strictObject({
	id: j.string(),
	month_start_ms: j.number(),
	month_end_ms: j.number(),
	bracket_size: j.number(),
	state: j.enum(['in_flight', 'concluded']),
	seeded_league_ids: j.array(j.string()),
	created_at_ms: j.number()
});

export type WireTournament = j.infer<typeof TournamentWireSchema>;

export const toWireTournament = (doc: {
	id: string;
	monthStartMs: number;
	monthEndMs: number;
	bracketSize: number;
	state: 'in_flight' | 'concluded';
	seededLeagueIds: string[];
	createdAtMs: number;
}): WireTournament => ({
	id: doc.id,
	month_start_ms: doc.monthStartMs,
	month_end_ms: doc.monthEndMs,
	bracket_size: doc.bracketSize,
	state: doc.state,
	seeded_league_ids: doc.seededLeagueIds,
	created_at_ms: doc.createdAtMs
});

export const TournamentMatchWireSchema = j.strictObject({
	tournament_id: j.string(),
	round: j.enum(['r1', 'quarter', 'semifinal', 'final']),
	index: j.number(),
	from_league_id: j.optional(j.string()),
	to_league_id: j.optional(j.string()),
	from_start_calls: j.optional(j.number()),
	from_start_wins: j.optional(j.number()),
	to_start_calls: j.optional(j.number()),
	to_start_wins: j.optional(j.number()),
	from_acc: j.optional(j.number()),
	to_acc: j.optional(j.number()),
	winner_league_id: j.optional(j.string()),
	start_ms: j.number(),
	end_ms: j.number()
});

export type WireTournamentMatch = j.infer<typeof TournamentMatchWireSchema>;

export const toWireTournamentMatch = (doc: {
	tournamentId: string;
	round: 'r1' | 'quarter' | 'semifinal' | 'final';
	index: number;
	fromLeagueId: string | null;
	toLeagueId: string | null;
	fromStartCalls: number | null;
	fromStartWins: number | null;
	toStartCalls: number | null;
	toStartWins: number | null;
	fromAcc: number | null;
	toAcc: number | null;
	winnerLeagueId: string | null;
	startMs: number;
	endMs: number;
}): WireTournamentMatch => ({
	tournament_id: doc.tournamentId,
	round: doc.round,
	index: doc.index,
	from_league_id: doc.fromLeagueId ?? undefined,
	to_league_id: doc.toLeagueId ?? undefined,
	from_start_calls: doc.fromStartCalls ?? undefined,
	from_start_wins: doc.fromStartWins ?? undefined,
	to_start_calls: doc.toStartCalls ?? undefined,
	to_start_wins: doc.toStartWins ?? undefined,
	from_acc: doc.fromAcc ?? undefined,
	to_acc: doc.toAcc ?? undefined,
	winner_league_id: doc.winnerLeagueId ?? undefined,
	start_ms: doc.startMs,
	end_ms: doc.endMs
});

// ─── Monthly leaderboard wire format ─────────────────────────────────────
//
// `getMonthlyLeaderboard` returns a result with two arrays:
// `items` (sharpest-eye podium, IDL field `items`) and `boldCallers`
// (bold-caller winners, IDL field `bold_callers`). Both contain
// `Vec<NestedStruct>` values, so both need snake_case wire schemas per
// the `Vec<NestedStruct>` quirk above.

export const MonthlyLeaderboardEntryWireSchema = j.strictObject({
	owner: PrincipalTextSchema,
	month_calls: j.number(),
	month_wins: j.number(),
	accuracy: j.number(),
	placement: j.number()
});

export type WireMonthlyLeaderboardEntry = j.infer<typeof MonthlyLeaderboardEntryWireSchema>;

export const toWireMonthlyLeaderboardEntry = (entry: {
	owner: string;
	monthCalls: number;
	monthWins: number;
	accuracy: number;
	placement: number;
}): WireMonthlyLeaderboardEntry => ({
	owner: entry.owner,
	month_calls: entry.monthCalls,
	month_wins: entry.monthWins,
	accuracy: entry.accuracy,
	placement: entry.placement
});

export const BoldCallerEntryWireSchema = j.strictObject({
	owner: PrincipalTextSchema,
	month_calls: j.number(),
	month_wins: j.number(),
	accuracy: j.number(),
	median_consensus: j.number()
});

export type WireBoldCallerEntry = j.infer<typeof BoldCallerEntryWireSchema>;

export const toWireBoldCallerEntry = (entry: {
	owner: string;
	monthCalls: number;
	monthWins: number;
	accuracy: number;
	medianConsensus: number;
}): WireBoldCallerEntry => ({
	owner: entry.owner,
	month_calls: entry.monthCalls,
	month_wins: entry.monthWins,
	accuracy: entry.accuracy,
	median_consensus: entry.medianConsensus
});
