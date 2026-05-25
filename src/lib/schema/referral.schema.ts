import { j } from '@junobuild/schema';

/**
 * Args for {@link redeemReferralCode}. Code is normalised to uppercase by the satellite before
 * lookup, so pasting either case from the FE works.
 */
export const RedeemReferralCodeArgsSchema = j.strictObject({
	code: j.string()
});

/**
 * Args for {@link lookupReferralCode}. Used by the FE to render a "Referred by …" preview before
 * the user submits the redemption.
 */
export const LookupReferralCodeArgsSchema = j.strictObject({
	code: j.string()
});
