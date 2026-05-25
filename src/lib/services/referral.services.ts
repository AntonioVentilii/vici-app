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
 * Submits a referral code redemption for the current caller. The satellite enforces:
 * - one-time per referee (the call traps on a second invocation),
 * - the caller must have a profile,
 * - self-referrals are rejected,
 * - the code must exist.
 *
 * Both VXP bonuses are paid out asynchronously by the satellite hook after this resolves.
 */
export const redeemReferralCode = async ({ code }: { code: string }): Promise<void> => {
	await functions.redeemReferralCode({ code });
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
