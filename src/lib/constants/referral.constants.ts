import { ZERO } from '$lib/constants/app.constants';
import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import { parseToken } from '$lib/utils/parse.utils';

/**
 * One-time VXP bonus awarded to the **referee** (the new user redeeming a code). Flat and
 * uncapped — every eligible new sign-up gets it exactly once. Sized in VXP base units via the
 * canonical `parseToken` helper.
 *
 * The **referrer** reward is *not* flat: it follows the diminishing curve in
 * {@link referrerRewardBaseUnits}, so the longer-term incentive to spam-share a code decays.
 */
export const REFERRAL_VXP_BONUS_BASE_UNITS = parseToken({
	value: '500',
	unitName: VXP_TOKEN.decimals
});

/**
 * Hard lifetime cap on the number of redemptions for which a single referrer is paid. Redemptions
 * beyond this cap are still recorded on the referrals collection (`withinReferrerCap = false`) so
 * we can monitor usage of widely-shared codes, but no transfer fires. Kept in lockstep with the
 * final bracket of {@link REFERRAL_REWARD_TIERS} — the curve yields `0` past this many prior paid
 * redemptions.
 */
export const REFERRAL_MAX_PAID = 30;

/**
 * Diminishing referrer-reward curve, keyed by the referrer's count of **prior** paid redemptions
 * (lifetime). Each tier covers an inclusive redemption-index range and pays a fixed VXP amount; the
 * reward shrinks as a code is reused, then drops to zero past {@link REFERRAL_MAX_PAID}.
 *
 * Redemption index (1-based, per referrer):
 * - 1–5   → 500 VXP
 * - 6–10  → 250 VXP
 * - 11–20 → 100 VXP
 * - 21–30 →  50 VXP
 * - >30   →   0 VXP (hard cap)
 *
 * Expressed as `{ throughIndex, value }` upper bounds so the lookup is a simple ascending scan.
 */
const REFERRAL_REWARD_TIERS: ReadonlyArray<{ throughIndex: number; value: string }> = [
	{ throughIndex: 5, value: '500' },
	{ throughIndex: 10, value: '250' },
	{ throughIndex: 20, value: '100' },
	{ throughIndex: 30, value: '50' }
];

const REFERRAL_REWARD_TIER_BASE_UNITS: ReadonlyArray<{ throughIndex: number; value: bigint }> =
	REFERRAL_REWARD_TIERS.map(({ throughIndex, value }) => ({
		throughIndex,
		value: parseToken({ value, unitName: VXP_TOKEN.decimals })
	}));

/**
 * Pure tier lookup: given how many paid redemptions a referrer has *already* banked (lifetime),
 * returns the VXP base-unit reward for the *next* redemption. Returns `ZERO` once the referrer has
 * reached {@link REFERRAL_MAX_PAID}, encoding the hard cap as part of the curve so callers need
 * only check for a zero reward.
 *
 * Authoritative on the server only — the referrer's prior-paid count must come from the satellite's
 * own scan of the referrals collection, never from the client.
 */
export const referrerRewardBaseUnits = (priorPaidCount: number): bigint => {
	const redemptionIndex = priorPaidCount + 1;

	for (const { throughIndex, value } of REFERRAL_REWARD_TIER_BASE_UNITS) {
		if (redemptionIndex <= throughIndex) {
			return value;
		}
	}

	return ZERO;
};

/**
 * Length of an auto-generated referral code. 8 chars over a 32-char alphabet = 40 bits of entropy,
 * which is enough to make collisions vanishingly rare while keeping codes short enough to share.
 */
export const REFERRAL_CODE_LENGTH = 8;

/**
 * Crockford base32 alphabet (no `I`, `L`, `O`, `U` — removes ambiguity with `1`/`0` and the rude
 * vowel). The satellite always emits uppercase; redemption input is normalised to uppercase before
 * lookup so users can paste either case.
 */
export const REFERRAL_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Regex used by the satellite assertion to validate code format. Kept in lockstep with
 * {@link REFERRAL_CODE_ALPHABET} and {@link REFERRAL_CODE_LENGTH}.
 */
export const REFERRAL_CODE_REGEX = new RegExp(
	`^[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`
);

/**
 * How long after profile creation a user is still considered "newly signed up" for referral
 * redemption purposes. After this window elapses, `redeemReferralCodeFn` refuses with
 * `existing_user_no_bonus` — the user can still use the code via `claimReferralFriendshipFn`
 * to add the referrer as a friend, but no VXP bonus is paid.
 *
 * Sized so a user who clicks an invite, gets interrupted, and comes back the next morning
 * still gets the bonus; longer-delayed signups fall back to the friendship-only path.
 */
export const REFERRAL_SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Wire-level error reason returned by `redeemReferralCodeFn` when the caller's profile is older
 * than {@link REFERRAL_SIGNUP_WINDOW_MS}. The FE matches on this exact string to branch into the
 * friendship-only flow.
 */
export const REFERRAL_EXISTING_USER_REASON = 'existing_user_no_bonus';
