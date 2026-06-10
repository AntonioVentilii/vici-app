import { functions } from '$declarations/satellite/satellite.api';
import type { ReferralListItem } from '$lib/types/referral';
import { fromWireReferral } from '$satellite/utils/wire-format.utils';
import type { PrincipalText } from '@junobuild/schema';

/**
 * Thin actor wrappers around the satellite referral endpoints. UI for the registration flow
 * (entering a code) and the "Your code / Friends you referred" panel will land in a follow-up
 * PR — this file exists so those surfaces can import a typed service without re-introducing the
 * `fromWire…` conversion plumbing inline.
 */

/**
 * Returns the caller's auto-generated referral code, if it has already been assigned. The code is
 * assigned by the satellite profile hook on first profile create — if a returning user is missing
 * one (e.g. signed in before the feature shipped), the next profile write backfills it.
 */
export const getMyReferralCode = async (): Promise<string | undefined> => {
	const { code } = await functions.getMyReferralCode();

	return code;
};

/**
 * Resolves a referral code to its owner principal (or `undefined` if unknown / malformed). Used
 * by the FE to render a "Referred by …" preview before the user confirms redemption.
 */
export const lookupReferralCode = async ({
	code
}: {
	code: string;
}): Promise<PrincipalText | undefined> => {
	const { owner } = await functions.lookupReferralCode({ code });

	return owner;
};

/**
 * Resolves a public handle (nickname) to that user's referral code, or `undefined` if the handle
 * is unknown (or its owner has no code yet). Backs the legacy `/join/{handle}` invite links: the
 * invite landing falls back to this when the URL slug isn't a valid referral code.
 */
export const lookupReferralCodeByHandle = async ({
	handle
}: {
	handle: string;
}): Promise<string | undefined> => {
	const { code } = await functions.lookupReferralCodeByHandle({ handle });

	return code;
};

/**
 * Submits a referral code redemption for the current caller. The satellite enforces:
 * - one-time per referee (the call traps on a second invocation),
 * - the caller must have a profile,
 * - the profile must be younger than {@link REFERRAL_SIGNUP_WINDOW_MS} — older accounts trap
 *   with {@link REFERRAL_EXISTING_USER_REASON} and should fall back to
 *   {@link claimReferralFriendship},
 * - self-referrals are rejected,
 * - the code must exist.
 *
 * On success the satellite also writes a bilateral confirmed friendship between referrer and
 * referee. Both VXP bonuses are paid out asynchronously by the post-write hook.
 */
export const redeemReferralCode = async ({ code }: { code: string }): Promise<void> => {
	await functions.redeemReferralCode({ code });
};

/**
 * Drives (or retries) the VXP payout for a referral row, keyed by the referee principal. The redeem
 * call already pays out inline; this is the self-heal / retry path for a payout that failed or that
 * predates the inline-payout fix. Idempotent server-side — safe to call for one's own principal on
 * every load.
 */
export const settleReferral = async ({ referee }: { referee: PrincipalText }): Promise<void> => {
	await functions.settleReferral({ referee });
};

/**
 * Friendship-only path for users who use a referral link past the signup grace period or who
 * have already redeemed a different code. No VXP transfer; only writes a bilateral confirmed
 * friendship between the caller and the code owner. Idempotent if a relation already exists.
 *
 * The satellite still validates the code shape, looks up the owner, and rejects self-referrals.
 */
export const claimReferralFriendship = async ({ code }: { code: string }): Promise<void> => {
	await functions.claimReferralFriendship({ code });
};

/**
 * Lists every redemption where the caller is the referrer, newest-first. Includes records
 * over the {@link REFERRAL_MAX_PAID} cap (those rows have `withinReferrerCap === false` and no
 * referrer payout) so the FE can show the full monitoring view.
 */
export const listMyReferrals = async (): Promise<ReferralListItem[]> => {
	const { items } = await functions.listMyReferrals();

	return items.map(fromWireReferral);
};
