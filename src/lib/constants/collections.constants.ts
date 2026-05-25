import collections from '$root/juno.collections.json';

export const Collection = {
	ROLES: collections.ROLES,
	PROFILES: collections.PROFILES,
	RELATIONS: collections.RELATIONS,
	CHATS: collections.CHATS,
	COMMENTS: collections.COMMENTS,
	MARKET_METADATA: collections.MARKET_METADATA,
	MARKET_TRANSLATIONS: collections.MARKET_TRANSLATIONS,
	ACTIVITIES: collections.ACTIVITIES,
	/**
	 * Server-driven VXP new-user ladder state (owed vs paid); written from satellite hooks.
	 */
	VXP_ONBOARDING: collections.VXP_ONBOARDING,
	/**
	 * Per-user, per-award ledger of every VXP gameplay award the server fires — streak
	 * milestones, comeback grant, referral payouts, Worlds podium. The doc key encodes
	 * `{recipient}/{awardType}/{awardKey}` so a second write at the same milestone collides
	 * with the first (natural idempotency). Status transitions `pending → paid | failed`
	 * are enforced by the satellite assert.
	 */
	VXP_AWARDS: collections.VXP_AWARDS,
	/**
	 * Reverse index from referral code (key) to owning principal. One row per user; written by the
	 * satellite profile hook on first profile create.
	 */
	REFERRAL_CODES: collections.REFERRAL_CODES,
	/**
	 * Per-referee redemption record (key = referee principal). Tracks the referrer, the code, and
	 * the payout state for both sides. Written by `redeemReferralCode`; payout state is updated by
	 * the satellite referral hook.
	 */
	REFERRALS: collections.REFERRALS
} as const;

export type Collection = (typeof Collection)[keyof typeof Collection];
