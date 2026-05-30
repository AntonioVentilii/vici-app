import { functions } from '$declarations/satellite/satellite.api';

/**
 * Thin actor wrappers around the satellite VXP-awards endpoints.
 *
 * The streak hook runs server-side off the profile-write trigger and
 * doesn't need a client call; the referral cap runs inside
 * \`onReferralSetForVxpPayout\` and also doesn't need one. The only
 * surface the FE has to actively call is the **comeback grant**, since
 * that's gated on the user's own balance state and only fires when the
 * client surfaces the affordance.
 */

/**
 * Reason codes the server returns when the comeback grant cannot be
 * paid this invocation. Re-exported so UI can switch on them without
 * pulling the entire satellite-generated type surface.
 */
export type VxpComebackReason =
	| 'already_claimed_paid'
	| 'already_claimed_pending'
	| 'already_claimed_failed'
	| 'balance_not_zero'
	| 'not_engaged_yet'
	| 'transfer_failed';

export interface VxpComebackClaim {
	/** Whether this invocation triggered a fresh payout. */
	paidNow: boolean;
	/** Whether a paid award doc exists (now or previously). */
	previouslyPaid: boolean;
	/** Ledger block index of the payout, decimal string, if paid. */
	blockIndex?: string;
	/** Machine-readable reason when not eligible / failed. */
	reason?: VxpComebackReason;
	/** Free-form error text when \`reason === 'transfer_failed'\`. */
	errorMessage?: string;
}

/**
 * Trigger the comeback grant. The server validates engagement
 * (≥1 paid VXP-onboarding milestone) + balance (must be zero) +
 * idempotency (no prior award doc) before transferring 1,000 VXP.
 *
 * Always resolves with a structured result — never rejects on expected
 * ineligibility. The FE renders a different toast / banner state per
 * \`reason\`. Rejection here only happens on transport-level errors.
 */
export const claimComebackGrant = async (): Promise<VxpComebackClaim> => {
	const result = await functions.claimComebackGrant();

	return {
		paidNow: result.paidNow,
		previouslyPaid: result.previouslyPaid,
		blockIndex: result.blockIndex,
		reason: result.reason,
		errorMessage: result.errorMessage
	};
};
