import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import { parseToken } from '$lib/utils/parse.utils';

/**
 * Per-redemption VXP bonus awarded to **both** the referrer (capped) and the referee (one-time).
 * Sized in VXP base units via the canonical `parseToken` helper.
 */
export const REFERRAL_VXP_BONUS_BASE_UNITS = parseToken({
	value: '500',
	unitName: VXP_TOKEN.decimals
});

/**
 * Maximum number of redemptions for which a single referrer is paid. Redemptions beyond this cap
 * are still recorded on the referrals collection (`withinReferrerCap = false`) so we can monitor
 * usage of widely-shared codes, but no transfer fires.
 */
export const REFERRAL_MAX_PAID = 5;

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
