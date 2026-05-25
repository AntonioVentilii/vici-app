import type { Principal } from '@icp-sdk/core/principal';

/**
 * Categories of server-fired VXP award. Each maps to a separate satellite
 * trigger:
 *
 *  - `streak`        — daily-call streak hits a milestone (3 / 7 / 14 / 30).
 *  - `comeback`      — one-shot grant when balance hits 0 for the first
 *                      time. Recipient's `firstDepletion` flag flips on
 *                      payout.
 *  - `referral`      — referrer is credited on a referee's onboarding
 *                      completion. Capped per calendar month.
 *  - `worlds_podium` — recipient's school finished top-3 in the monthly
 *                      bout. Awarded at month rollover.
 *
 * See `docs/economy.md` in the design prototype for the full spec.
 */
export type VxpAwardType = 'streak' | 'comeback' | 'referral' | 'worlds_podium';

/**
 * Payout lifecycle for a single award. Once `paid`, the doc is immutable
 * (enforced by `assertSetVxpAward`).
 */
export type VxpAwardStatus = 'pending' | 'paid' | 'failed';

/**
 * Persisted shape stored in the `vxp_awards` collection. Doc key is
 * `${recipient}/${awardType}/${awardKey}` — collisions on retry are
 * natural idempotency.
 *
 * Amounts and ledger block indexes are stored as decimal strings so the
 * doc serialises cleanly through JSON (Juno doesn't persist native
 * bigints).
 */
export interface VxpAwardDoc {
	/** Principal text of the recipient. Encoded in the doc key too. */
	recipient: string;
	/** Award category — drives which satellite trigger fired it. */
	awardType: VxpAwardType;
	/**
	 * Stable sub-identifier within `awardType`. Encoded in the doc key too.
	 *
	 *  - `streak`        — one of `'streak_3' | 'streak_7' | 'streak_14' | 'streak_30'`.
	 *  - `comeback`      — always the literal `'comeback'` (one-shot per account).
	 *  - `referral`      — the referee principal text.
	 *  - `worlds_podium` — `'<YYYY-MM>_gold' | '<YYYY-MM>_silver' | '<YYYY-MM>_bronze'`.
	 */
	awardKey: string;
	/** Payout amount in VXP base units, decimal string. */
	amountBaseUnits: string;
	/** Lifecycle status. Transitions `pending → paid | failed` only. */
	status: VxpAwardStatus;
	/** When the award became eligible (ms since epoch). */
	earnedAtMs: number;
	/** When the ledger transfer completed (ms since epoch). Set on `paid`. */
	paidAtMs?: number;
	/** Ledger block index of the payout, decimal string. Set on `paid`. */
	blockIndex?: string;
	/** Short reason the payout failed. Set on `failed`. */
	errorMessage?: string;
}

/**
 * Builds the canonical doc key for an award. Used both at the assert site
 * (to validate the key matches the embedded fields) and at the write
 * site so callers can't drift.
 */
export const vxpAwardKey = ({
	recipient,
	awardType,
	awardKey
}: {
	recipient: Principal | string;
	awardType: VxpAwardType;
	awardKey: string;
}): string => {
	const recipientText = typeof recipient === 'string' ? recipient : recipient.toText();

	return `${recipientText}/${awardType}/${awardKey}`;
};
