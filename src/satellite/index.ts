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
import { assertSetBout } from '$satellite/services/bout.services';
import {
	listLeagueBoutsFn,
	listLeagueMembersFn,
	listMyBoutsFn,
	listMyLeaguesFn,
	lookupLeagueByInviteFn
} from '$satellite/services/cohort.services';
import {
	syncRoleToEngineOnDelete,
	syncRoleToEngineOnSet
} from '$satellite/services/engine-sync.services';
import { listLeaderboard as listLeaderboardFn } from '$satellite/services/leaderboard.services';
import {
	assertDeleteLeagueMember,
	assertSetLeagueMember
} from '$satellite/services/league-member.services';
import { assertSetLeague } from '$satellite/services/league.services';
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
import { assertSetVxpAward } from '$satellite/services/vxp-awards.services';
import { claimComebackGrantFn } from '$satellite/services/vxp-comeback.services';
import {
	onProfileSetForVxpOnboarding,
	onTradeActivityForVxpOnboarding
} from '$satellite/services/vxp-onboarding.services';
import { onProfileSetForStreakAward } from '$satellite/services/vxp-streak-awards.services';
import {
	BoutWireSchema,
	LeagueMemberWireSchema,
	LeagueWireSchema,
	LeagueWithRoleWireSchema,
	MarketTranslationWireSchema,
	ReferralWireSchema,
	RelationWireSchema,
	toWireBout,
	toWireLeague,
	toWireLeagueMember,
	toWireLeagueWithRole,
	toWireMarketTranslation,
	toWireProfile,
	toWireReferral,
	toWireRelation,
	UserProfileWireSchema
} from '$satellite/utils/wire-format.utils';
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

// ─── Social cohorts (Phase 10) ───────────────────────────────────────────

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

// ─── Bouts (Phase 10) ────────────────────────────────────────────────────

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

// V1.2 comeback grant — one-shot +1000 VXP fired when a balance hits
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

const assertSetDocCollections = [
	Collection.PROFILES,
	Collection.ROLES,
	Collection.REFERRAL_CODES,
	Collection.REFERRALS,
	Collection.VXP_AWARDS,
	Collection.LEAGUES,
	Collection.LEAGUE_MEMBERS,
	Collection.BOUTS
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
			[Collection.BOUTS]: assertSetBout
		};

		fn[context.data.collection]?.(context);
	}
});

const assertDeleteDocCollections = [Collection.LEAGUE_MEMBERS] as const;

type AssertDeleteDocCollection = (typeof assertDeleteDocCollections)[number];

export const assertDeleteDoc = defineAssert<AssertDeleteDoc>({
	collections: assertDeleteDocCollections,
	assert: (context) => {
		const fn: Record<AssertDeleteDocCollection, (ctx: AssertDeleteDocContext) => void> = {
			[Collection.LEAGUE_MEMBERS]: assertDeleteLeagueMember
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
