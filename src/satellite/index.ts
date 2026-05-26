import { Collection } from '$lib/constants/collections.constants';
import {
	GetMarketMetadataArgsSchema,
	MarketMetadataSchema,
	UpsertMarketMetadataArgsSchema
} from '$lib/schema/market-metadata.schema';
import {
	GetMarketTranslationArgsSchema,
	ListMarketTranslationsArgsSchema,
	MarketTranslationSchema,
	UpsertMarketTranslationArgsSchema
} from '$lib/schema/market-translation.schema';
import { UserProfileSchema } from '$lib/schema/profile.schema';
import {
	LookupReferralCodeArgsSchema,
	RedeemReferralCodeArgsSchema
} from '$lib/schema/referral.schema';
import { CheckFriendshipArgsSchema } from '$lib/schema/relation.schema';
import { deleteMyAccountFn, listMyBlockingLeaguesFn } from '$satellite/services/account.services';
import {
	assertSetAffiliationStats,
	onProfileSetForAffiliationStats
} from '$satellite/services/affiliation-stats.services';
import {
	assertDeleteAffiliation,
	assertSetAffiliation
} from '$satellite/services/affiliation.services';
import { assertDeleteBout, assertSetBout } from '$satellite/services/bout.services';
import {
	getAffiliationStatsFn,
	listAffiliationStatsFn,
	listLeagueBoutsFn,
	listLeagueMembersFn,
	listMyAffiliationsFn,
	listMyBoutsFn,
	listMyLeaguesFn,
	listWorldsRosterFn,
	lookupLeagueByInviteFn
} from '$satellite/services/cohort.services';
import {
	syncRoleToEngineOnDelete,
	syncRoleToEngineOnSet
} from '$satellite/services/engine-sync.services';
import { assertSetExitSignal } from '$satellite/services/exit-signal.services';
import { listLeaderboard as listLeaderboardFn } from '$satellite/services/leaderboard.services';
import {
	assertDeleteLeagueMember,
	assertSetLeagueMember
} from '$satellite/services/league-member.services';
import {
	assertSetLeagueStats,
	onProfileSetForLeagueStats
} from '$satellite/services/league-stats.services';
import { assertSetLeague, transferLeagueOwnershipFn } from '$satellite/services/league.services';
import {
	getMarketMetadata as getMarketMetadataFn,
	upsertMarketMetadata as upsertMarketMetadataFn
} from '$satellite/services/market-metadata.services';
import {
	getMarketTranslation as getMarketTranslationFn,
	listMarketTranslations as listMarketTranslationsFn,
	upsertMarketTranslation as upsertMarketTranslationFn
} from '$satellite/services/market-translation.services';
import {
	assertValidNickname,
	checkNicknameAvailabilityFn,
	getProfile as getProfileFn,
	searchProfiles as searchProfilesFn
} from '$satellite/services/profile.services';
import {
	assertSetReferral,
	assertSetReferralCode,
	getMyReferralCodeFn,
	listMyReferralsFn,
	lookupReferralCodeFn,
	onProfileSetForReferralCode,
	onReferralSetForVxpPayout,
	redeemReferralCodeFn
} from '$satellite/services/referral.services';
import {
	acceptFriendRequest as acceptFriendRequestFn,
	cancelFriendRequest as cancelFriendRequestFn,
	checkFriendship as checkFriendshipFn,
	followUser as followUserFn,
	listFollowers as listFollowersFn,
	listFollowing as listFollowingFn,
	listFriendRequests as listFriendRequestsFn,
	listFriends as listFriendsFn,
	listSentFriendRequests as listSentFriendRequestsFn,
	rejectFriendRequest as rejectFriendRequestFn,
	sendFriendRequest as sendFriendRequestFn
} from '$satellite/services/relation.services';
import { assertSetRole } from '$satellite/services/roles.services';
import {
	assertSetTournament,
	assertSetTournamentMatch,
	claimTournamentPrizeFn,
	getCurrentTournamentFn,
	resolveTournamentRoundFn,
	triggerTournamentDrawFn
} from '$satellite/services/tournament.services';
import { assertSetUserStats } from '$satellite/services/user-stats.services';
import { assertSetVxpAward } from '$satellite/services/vxp-awards.services';
import { claimComebackGrantFn } from '$satellite/services/vxp-comeback.services';
import {
	onProfileSetForVxpOnboarding,
	onTradeActivityForVxpOnboarding
} from '$satellite/services/vxp-onboarding.services';
import { onProfileSetForStreakAward } from '$satellite/services/vxp-streak-awards.services';
import { claimWorldsPodiumPrizeFn } from '$satellite/services/vxp-worlds-podium.services';
import {
	AffiliationStatsWireSchema,
	AffiliationWireSchema,
	BoutWireSchema,
	LeagueMemberWireSchema,
	LeagueWireSchema,
	LeagueWithRoleWireSchema,
	MarketTranslationWireSchema,
	ReferralWireSchema,
	RelationWireSchema,
	TournamentMatchWireSchema,
	TournamentWireSchema,
	toWireAffiliation,
	toWireAffiliationStats,
	toWireBout,
	toWireLeague,
	toWireLeagueMember,
	toWireLeagueWithRole,
	toWireMarketTranslation,
	toWireProfile,
	toWireReferral,
	toWireRelation,
	toWireTournament,
	toWireTournamentMatch,
	UserProfileWireSchema
} from '$satellite/utils/wire-format.utils';
import { nonNullish } from '@dfinity/utils';
import {
	defineAssert,
	defineHook,
	defineQuery,
	defineUpdate,
	type AssertDeleteDoc,
	type AssertDeleteDocContext,
	type AssertSetDoc,
	type AssertSetDocContext,
	type OnDeleteDoc,
	type OnDeleteDocContext,
	type OnSetDoc,
	type OnSetDocContext,
	type RunFunction
} from '@junobuild/functions';
import { j, PrincipalTextSchema } from '@junobuild/schema';

export const listLeaderboard = defineQuery({
	// Uses the snake_case wire schema. Sputnik's codegen doesn't apply
	// `#[json_data(nested)]` to `Vec<NestedStruct>` fields, so the wire
	// format for items is whatever the inner Rust struct's original
	// `Deserialize` impl expects — snake_case. See
	// `src/satellite/utils/wire-format.utils.ts` for the full rationale.
	// `.transform()` on the result schema is NOT an option: juno's codegen
	// only accepts `ZodObject` and fails with "Unsupported type:
	// unrepresentable schema" on `ZodEffects`, which silently kills the
	// whole `juno functions build`.
	result: j.strictObject({
		items: j.array(UserProfileWireSchema)
	}),
	handler: () => ({
		items: listLeaderboardFn().map(toWireProfile)
	})
});

export const getProfile = defineQuery({
	args: j.strictObject({
		// `principal` collides with @junobuild/schema's reserved name; rename on the wire.
		principalStr: PrincipalTextSchema
	}),
	result: j.strictObject({
		profile: j.optional(UserProfileSchema)
	}),
	handler: ({ principalStr }) => ({
		profile: getProfileFn(principalStr)
	})
});

export const searchProfiles = defineQuery({
	args: j.strictObject({
		// `query` collides with @junobuild/schema's reserved name; rename on the wire.
		queryStr: j.string()
	}),
	result: j.strictObject({
		items: j.array(UserProfileWireSchema)
	}),
	handler: ({ queryStr }) => ({
		items: searchProfilesFn(queryStr).map(toWireProfile)
	})
});

// Typed availability probe used by the onboarding handle field and the
// profile-edit form so the UI can render an inline "already taken" hint
// before attempting `setDoc`. The same validator backs `assertValidNickname`
// (write-time guard), so client and server agree on what "taken" means.
//
// `excludePrincipalStr` is the editing user's principal — passed so a user
// editing their own profile is not told their own nickname is taken.
// `principal` is reserved by the schema layer; we expose it as
// `excludePrincipalStr` and treat the empty string as "no exclusion".
export const checkNicknameAvailability = defineQuery({
	args: j.strictObject({
		nickname: j.string(),
		excludePrincipalStr: j.string()
	}),
	result: j.strictObject({
		available: j.boolean(),
		reason: j.optional(j.enum(['required', 'too_short', 'taken']))
	}),
	handler: ({ nickname, excludePrincipalStr }) => {
		const result = checkNicknameAvailabilityFn({
			nickname,
			excludeKey: excludePrincipalStr.length > 0 ? excludePrincipalStr : undefined
		});

		return result.available
			? { available: true as const }
			: { available: false as const, reason: result.reason };
	}
});

export const getMarketMetadata = defineQuery({
	args: GetMarketMetadataArgsSchema,
	result: j.strictObject({
		metadata: j.optional(MarketMetadataSchema)
	}),
	handler: (args) => ({
		metadata: getMarketMetadataFn(args)
	})
});

export const upsertMarketMetadata = defineUpdate({
	args: UpsertMarketMetadataArgsSchema,
	result: j.strictObject({
		metadata: MarketMetadataSchema
	}),
	handler: async (args) => ({
		metadata: await upsertMarketMetadataFn(args)
	})
});

export const getMarketTranslation = defineQuery({
	args: GetMarketTranslationArgsSchema,
	result: j.strictObject({
		translation: j.optional(MarketTranslationSchema)
	}),
	handler: (args) => ({
		translation: getMarketTranslationFn(args)
	})
});

export const listMarketTranslations = defineQuery({
	args: ListMarketTranslationsArgsSchema,
	result: j.strictObject({
		items: j.array(MarketTranslationWireSchema)
	}),
	handler: (args) => ({
		items: listMarketTranslationsFn(args).map(toWireMarketTranslation)
	})
});

export const upsertMarketTranslation = defineUpdate({
	args: UpsertMarketTranslationArgsSchema,
	result: j.strictObject({
		translation: MarketTranslationSchema
	}),
	handler: (args) => ({
		translation: upsertMarketTranslationFn(args)
	})
});

export const listFriends = defineQuery({
	result: j.strictObject({
		items: j.array(RelationWireSchema)
	}),
	handler: () => ({ items: listFriendsFn().map(toWireRelation) })
});

export const listFollowers = defineQuery({
	result: j.strictObject({
		items: j.array(RelationWireSchema)
	}),
	handler: () => ({ items: listFollowersFn().map(toWireRelation) })
});

export const listFollowing = defineQuery({
	result: j.strictObject({
		items: j.array(RelationWireSchema)
	}),
	handler: () => ({ items: listFollowingFn().map(toWireRelation) })
});

export const checkFriendship = defineQuery({
	args: CheckFriendshipArgsSchema,
	result: j.strictObject({
		isFriend: j.boolean()
	}),
	handler: (args) => ({ isFriend: checkFriendshipFn(args) })
});

export const listFriendRequests = defineQuery({
	result: j.strictObject({
		items: j.array(RelationWireSchema)
	}),
	handler: () => ({
		items: listFriendRequestsFn().map(toWireRelation)
	})
});

export const listSentFriendRequests = defineQuery({
	result: j.strictObject({
		items: j.array(RelationWireSchema)
	}),
	handler: () => ({
		items: listSentFriendRequestsFn().map(toWireRelation)
	})
});

export const sendFriendRequest = defineUpdate({
	args: j.strictObject({
		target: PrincipalTextSchema
	}),
	handler: sendFriendRequestFn
});

export const acceptFriendRequest = defineUpdate({
	args: j.strictObject({
		relationId: j.string()
	}),
	handler: acceptFriendRequestFn
});

export const rejectFriendRequest = defineUpdate({
	args: j.strictObject({
		relationId: j.string()
	}),
	handler: rejectFriendRequestFn
});

export const cancelFriendRequest = defineUpdate({
	args: j.strictObject({
		relationId: j.string()
	}),
	handler: cancelFriendRequestFn
});

export const followUser = defineUpdate({
	args: j.strictObject({
		target: PrincipalTextSchema
	}),
	handler: followUserFn
});

// ─── Referrals ───────────────────────────────────────────────────────────

export const getMyReferralCode = defineQuery({
	result: j.strictObject({
		code: j.string().optional()
	}),
	handler: getMyReferralCodeFn
});

export const lookupReferralCode = defineQuery({
	args: LookupReferralCodeArgsSchema,
	result: j.strictObject({
		owner: PrincipalTextSchema.optional()
	}),
	handler: lookupReferralCodeFn
});

export const listMyReferrals = defineQuery({
	result: j.strictObject({
		items: j.array(ReferralWireSchema)
	}),
	handler: () => ({ items: listMyReferralsFn().map(toWireReferral) })
});

export const redeemReferralCode = defineUpdate({
	args: RedeemReferralCodeArgsSchema,
	handler: redeemReferralCodeFn
});

// ─── Social cohorts ─────────────────────────────────────────────

export const listMyLeagues = defineQuery({
	result: j.strictObject({
		items: j.array(LeagueWithRoleWireSchema)
	}),
	handler: () => ({
		items: listMyLeaguesFn().map(toWireLeagueWithRole)
	})
});

export const listLeagueMembers = defineQuery({
	args: j.strictObject({
		leagueId: j.string()
	}),
	result: j.strictObject({
		items: j.array(LeagueMemberWireSchema)
	}),
	handler: ({ leagueId }) => ({
		items: listLeagueMembersFn({ leagueId }).map(toWireLeagueMember)
	})
});

// Join-by-code resolver. The FE join modal posts the 6-char code,
// the satellite scans `leagues` for a match, and the FE then
// derives the leagueId and writes the `league_members` row through
// the standard set-doc path (which goes through `assertSetLeagueMember`).
export const lookupLeagueByInvite = defineQuery({
	args: j.strictObject({
		inviteCode: j.string()
	}),
	result: j.strictObject({
		league: j.optional(LeagueWireSchema)
	}),
	handler: ({ inviteCode }) => {
		const league = lookupLeagueByInviteFn({ inviteCode });

		return { league: league ? toWireLeague(league) : undefined };
	}
});

// ─── Bouts ──────────────────────────────────────────────────────

export const listLeagueBouts = defineQuery({
	args: j.strictObject({
		leagueId: j.string()
	}),
	result: j.strictObject({
		items: j.array(BoutWireSchema)
	}),
	handler: ({ leagueId }) => ({
		items: listLeagueBoutsFn({ leagueId }).map(toWireBout)
	})
});

export const listMyBouts = defineQuery({
	result: j.strictObject({
		items: j.array(BoutWireSchema)
	}),
	handler: () => ({
		items: listMyBoutsFn().map(toWireBout)
	})
});

// ─── Worlds affiliations ────────────────────────────────────────

export const listMyAffiliations = defineQuery({
	result: j.strictObject({
		university: j.optional(AffiliationWireSchema),
		country: j.optional(AffiliationWireSchema)
	}),
	handler: () => {
		const { university, country } = listMyAffiliationsFn();

		return {
			university: university ? toWireAffiliation(university) : undefined,
			country: country ? toWireAffiliation(country) : undefined
		};
	}
});

export const listWorldsRoster = defineQuery({
	args: j.strictObject({
		kind: j.enum(['university', 'country']),
		affiliationId: j.string()
	}),
	result: j.strictObject({
		items: j.array(AffiliationWireSchema)
	}),
	handler: ({ kind, affiliationId }) => ({
		items: listWorldsRosterFn({ kind, affiliationId }).map(toWireAffiliation)
	})
});

// Per-affiliation stats (rolling lifetime + monthly counters). The
// `stats` field is optional because a brand-new affiliation has no
// resolution events yet and therefore no doc.
export const getAffiliationStats = defineQuery({
	args: j.strictObject({
		kind: j.enum(['university', 'country']),
		affiliationId: j.string()
	}),
	result: j.strictObject({
		stats: j.optional(AffiliationStatsWireSchema)
	}),
	handler: ({ kind, affiliationId }) => {
		const stats = getAffiliationStatsFn({ kind, affiliationId });

		return {
			stats: nonNullish(stats) ? toWireAffiliationStats(stats) : undefined
		};
	}
});

// Ranked leaderboard view across every stats doc of a kind.
// Below MIN_CALLS_FOR_RANK is filtered out by the aggregator.
export const listAffiliationStats = defineQuery({
	args: j.strictObject({
		kind: j.enum(['university', 'country']),
		limit: j.number().optional()
	}),
	result: j.strictObject({
		items: j.array(AffiliationStatsWireSchema)
	}),
	handler: ({ kind, limit }) => ({
		items: listAffiliationStatsFn({ kind, limit }).map(toWireAffiliationStats)
	})
});

// Comeback grant — one-shot +1000 VXP fired when a balance hits
// zero on an engaged account. FE detects the zero-balance state and
// calls this endpoint; server validates engagement + balance and
// fires the transfer. Idempotency via the `vxp_awards` doc key.
export const claimComebackGrant = defineUpdate({
	result: j.strictObject({
		paidNow: j.boolean(),
		previouslyPaid: j.boolean(),
		blockIndex: j.optional(j.string()),
		reason: j.optional(
			j.enum([
				'already_claimed_paid',
				'already_claimed_pending',
				'already_claimed_failed',
				'balance_not_zero',
				'not_engaged_yet',
				'transfer_failed'
			])
		),
		errorMessage: j.optional(j.string())
	}),
	handler: claimComebackGrantFn
});

// Worlds podium monthly payout — user-claim variant. The caller
// passes `monthAnchor` (YYYY-MM) for a closed month; if their
// current affiliation finished top-3 in that month's snapshot,
// VXP_AWARDS docs are created (gold/silver/bronze) and a ledger
// transfer is fired. Idempotent via the award doc key.
export const claimWorldsPodiumPrize = defineUpdate({
	args: j.strictObject({
		monthAnchor: j.string()
	}),
	result: j.strictObject({
		monthAnchor: j.string(),
		awardsCreated: j.number(),
		awardsAlreadyClaimed: j.number(),
		notEligible: j.boolean()
	}),
	handler: claimWorldsPodiumPrizeFn
});

// Account deletion — Proposal 4. Pre-flight query that surfaces the
// "you still own this non-empty league" guard so the FE can show
// the transfer-first prompt before the user even picks a reason.
export const listMyBlockingLeagues = defineQuery({
	result: j.strictObject({
		leagueIds: j.array(j.string())
	}),
	handler: listMyBlockingLeaguesFn
});

// Account deletion — the deletion itself. Writes an anonymous
// `EXIT_SIGNALS` doc, then cascades hard-deletes for the caller's
// profile + identity-keyed rows (VXP awards / onboarding, referral
// code + redemption, affiliations, relations, league memberships,
// owned-empty leagues). Shared audit rows (activities, bouts,
// comments) are left in place — the principal is gone so they're
// orphaned but immutable.
//
// Returns `ok: false` with `reason: 'owns_non_empty_league'` when
// the caller still owns a league with other members; the FE
// renders a transfer-first guard in that branch.
export const deleteMyAccount = defineUpdate({
	args: j.strictObject({
		reason: j.string(),
		note: j.string()
	}),
	result: j.strictObject({
		ok: j.boolean(),
		reason: j.optional(j.enum(['owns_non_empty_league', 'invalid_input'])),
		blockingLeagueIds: j.optional(j.array(j.string())),
		docsDeleted: j.optional(j.number())
	}),
	handler: deleteMyAccountFn
});

// Monthly tournament — Proposal 3. The draw is fire-and-forget on
// every Tournament-page mount: idempotent via doc-key collision on
// the month anchor (a second call returns `already_drawn` cleanly).
// Round resolution + prize claim are documented Proposal 3 follow-ups
// — they need a per-window accuracy aggregation pipeline that
// doesn't exist yet, so the bracket structure ships first.
export const triggerTournamentDraw = defineUpdate({
	args: j.strictObject({
		monthAnchor: j.string()
	}),
	result: j.strictObject({
		ok: j.boolean(),
		tournamentId: j.optional(j.string()),
		reason: j.optional(
			j.enum(['already_drawn', 'month_not_started', 'insufficient_leagues', 'invalid_input'])
		),
		availableLeagues: j.optional(j.number())
	}),
	handler: triggerTournamentDrawFn
});

// League ownership transfer — used by the league-detail "transfer
// ownership" CTA and surfaced from the account-delete owner guard
// so the user can resolve the blocking guard in one click.
//
// Refusal reasons:
//  - `not_owner` — caller isn't the current owner.
//  - `league_not_found` — leagueId resolves to nothing.
//  - `new_owner_not_member` — target principal isn't a member of
//    the league.
//  - `new_owner_is_caller` — no-op self-transfer rejected
//    explicitly so the FE can render a clear error.
//  - `invalid_input` — `newOwnerPrincipal` is not a valid principal
//    text.
export const transferLeagueOwnership = defineUpdate({
	args: j.strictObject({
		leagueId: j.string(),
		newOwnerPrincipal: PrincipalTextSchema
	}),
	result: j.strictObject({
		ok: j.boolean(),
		reason: j.optional(
			j.enum([
				'not_owner',
				'league_not_found',
				'new_owner_not_member',
				'new_owner_is_caller',
				'invalid_input'
			])
		)
	}),
	handler: transferLeagueOwnershipFn
});

export const getCurrentTournament = defineQuery({
	result: j.strictObject({
		tournament: j.optional(TournamentWireSchema),
		matches: j.array(TournamentMatchWireSchema)
	}),
	handler: () => {
		const { tournament, matches } = getCurrentTournamentFn();

		return {
			tournament: tournament === null ? undefined : toWireTournament(tournament),
			matches: matches.map(toWireTournamentMatch)
		};
	}
});

// Round resolution — user-claim; idempotent via the `winnerLeagueId`
// write-once invariant on match docs. Anyone can call when a round
// has closed; the FE fires this on every Tournament-page mount for
// each round whose `endMs <= now` and which still has unresolved
// matches.
//
// Refusal reasons:
//  - `tournament_not_found` — tournamentId resolves to nothing.
//  - `round_not_yet_closed` — the round's `endMs` is still in the future.
//  - `previous_round_not_resolved` — an earlier round has unresolved
//    matches; the bracket has to advance in order.
//  - `no_matches` — no match docs for the round (shouldn't happen).
//  - `invalid_input` — `round` is not one of `r1|quarter|semifinal|final`.
export const resolveTournamentRound = defineUpdate({
	args: j.strictObject({
		tournamentId: j.string(),
		round: j.string()
	}),
	result: j.strictObject({
		ok: j.boolean(),
		reason: j.optional(
			j.enum([
				'tournament_not_found',
				'round_not_yet_closed',
				'previous_round_not_resolved',
				'no_matches',
				'invalid_input'
			])
		),
		matchesResolved: j.optional(j.number()),
		tournamentConcluded: j.optional(j.boolean())
	}),
	handler: resolveTournamentRoundFn
});

// Prize claim — user-claim; idempotent via the VXP_AWARDS doc key.
// Caller computes their highest-tier placement (1 / 2 / 3) by
// checking membership in the bracket's winning leagues; the
// satellite writes a VXP_AWARDS doc and returns the credited amount.
//
// Refusal reasons:
//  - `tournament_not_found` — tournamentId resolves to nothing.
//  - `tournament_not_concluded` — bracket is still in flight.
//  - `not_member_of_top_league` — caller isn't a member of any
//    top-3 league.
export const claimTournamentPrize = defineUpdate({
	args: j.strictObject({
		tournamentId: j.string()
	}),
	result: j.strictObject({
		ok: j.boolean(),
		reason: j.optional(
			j.enum(['tournament_not_found', 'tournament_not_concluded', 'not_member_of_top_league'])
		),
		awardsCreated: j.optional(j.number()),
		awardsAlreadyClaimed: j.optional(j.number()),
		totalVxpCredited: j.optional(j.number())
	}),
	handler: claimTournamentPrizeFn
});

const assertSetDocCollections = [
	Collection.PROFILES,
	Collection.ROLES,
	Collection.REFERRAL_CODES,
	Collection.REFERRALS,
	Collection.VXP_AWARDS,
	Collection.LEAGUES,
	Collection.LEAGUE_MEMBERS,
	Collection.BOUTS,
	Collection.AFFILIATIONS,
	Collection.AFFILIATION_STATS,
	Collection.EXIT_SIGNALS,
	Collection.TOURNAMENTS,
	Collection.TOURNAMENT_MATCHES,
	Collection.LEAGUE_STATS,
	Collection.USER_STATS
] as const;

type AssertSetDocCollection = (typeof assertSetDocCollections)[number];

export const assertSetDoc = defineAssert<AssertSetDoc>({
	collections: assertSetDocCollections,
	assert: (context) => {
		const fn: Record<AssertSetDocCollection, (ctx: AssertSetDocContext) => void> = {
			[Collection.PROFILES]: assertValidNickname,
			[Collection.ROLES]: assertSetRole,
			[Collection.REFERRAL_CODES]: assertSetReferralCode,
			[Collection.REFERRALS]: assertSetReferral,
			[Collection.VXP_AWARDS]: assertSetVxpAward,
			[Collection.LEAGUES]: assertSetLeague,
			[Collection.LEAGUE_MEMBERS]: assertSetLeagueMember,
			[Collection.BOUTS]: assertSetBout,
			[Collection.AFFILIATIONS]: assertSetAffiliation,
			[Collection.AFFILIATION_STATS]: assertSetAffiliationStats,
			[Collection.EXIT_SIGNALS]: assertSetExitSignal,
			[Collection.TOURNAMENTS]: assertSetTournament,
			[Collection.TOURNAMENT_MATCHES]: assertSetTournamentMatch,
			[Collection.LEAGUE_STATS]: assertSetLeagueStats,
			[Collection.USER_STATS]: assertSetUserStats
		};

		fn[context.data.collection]?.(context);
	}
});

const assertDeleteDocCollections = [
	Collection.LEAGUE_MEMBERS,
	Collection.AFFILIATIONS,
	Collection.BOUTS
] as const;

type AssertDeleteDocCollection = (typeof assertDeleteDocCollections)[number];

export const assertDeleteDoc = defineAssert<AssertDeleteDoc>({
	collections: assertDeleteDocCollections,
	assert: (context) => {
		const fn: Record<AssertDeleteDocCollection, (ctx: AssertDeleteDocContext) => void> = {
			[Collection.LEAGUE_MEMBERS]: assertDeleteLeagueMember,
			[Collection.AFFILIATIONS]: assertDeleteAffiliation,
			[Collection.BOUTS]: assertDeleteBout
		};

		fn[context.data.collection]?.(context);
	}
});

const setDocCollections = [
	Collection.ACTIVITIES,
	Collection.PROFILES,
	Collection.ROLES,
	Collection.REFERRALS
] as const;

type OnSetDocCollection = (typeof setDocCollections)[number];

/**
 * Composed `profiles` post-write handler. Each sub-hook (`onProfileSetForVxpOnboarding`,
 * `onProfileSetForReferralCode`) is exported independently from its service so they remain
 * unit-testable; we compose them here so the dispatch table keeps its one-handler-per-collection
 * invariant.
 */
const onProfileSetComposed: RunFunction<OnSetDocContext> = async (context) => {
	await onProfileSetForVxpOnboarding(context);
	onProfileSetForReferralCode(context);
	await onProfileSetForStreakAward(context);
	onProfileSetForAffiliationStats(context);
	onProfileSetForLeagueStats(context);
};

export const onSetDoc = defineHook<OnSetDoc>({
	collections: setDocCollections,
	run: async (context) => {
		const fn: Record<OnSetDocCollection, RunFunction<OnSetDocContext>> = {
			[Collection.PROFILES]: onProfileSetComposed,
			[Collection.ACTIVITIES]: onTradeActivityForVxpOnboarding,
			[Collection.ROLES]: syncRoleToEngineOnSet,
			[Collection.REFERRALS]: onReferralSetForVxpPayout
		};

		await fn[context.data.collection]?.(context);
	}
});

const deleteDocCollections = [Collection.ROLES] as const;

type OnDeleteDocCollection = (typeof deleteDocCollections)[number];

export const onDeleteDoc = defineHook<OnDeleteDoc>({
	collections: deleteDocCollections,
	run: async (context) => {
		const fn: Record<OnDeleteDocCollection, RunFunction<OnDeleteDocContext>> = {
			[Collection.ROLES]: syncRoleToEngineOnDelete
		};

		await fn[context.data.collection]?.(context);
	}
});
