// Referral payout settlement. A redemption records the referrals row (the
// redeem endpoint lands with the account phase); nothing pays until the
// referred user makes their FIRST prediction, so sign-ups that never engage
// reward nobody. Both sides then settle together: the flat referee bonus and
// the referrer's diminishing-curve reward, each as an idempotent
// referral/<refereeUserId> award on its own recipient.

import { isNullish } from '@dfinity/utils';
import { query } from '../db/client';
import { ZERO } from '../lib/constants';
import { logger } from '../lib/logger';
import { grantAward } from './awards';
import { REFERRAL_VXP_BONUS_BASE_UNITS, referrerRewardBaseUnits } from './constants';

export interface ReferralRow {
	referee_user_id: string;
	referrer_user_id: string;
	code: string;
	redeemed_at_ms: string;
	within_referrer_cap: boolean | null;
}

export const getReferralRow = async (refereeUserId: string): Promise<ReferralRow | undefined> => {
	const rows = await query<ReferralRow>(
		`select referee_user_id, referrer_user_id, code, redeemed_at_ms::text, within_referrer_cap
		 from referrals where referee_user_id = $1`,
		[refereeUserId]
	);

	return rows[0];
};

/** Whether the referee has made at least one prediction: the settlement gate.
 * Counts only trade activities, exactly like the first-prediction rule the
 * satellite applied. */
const refereeHasTraded = async (refereeUserId: string): Promise<boolean> => {
	const rows = await query<{ count: string }>(
		`select count(*)::text as count from activities where user_id = $1 and type = 'trade'`,
		[refereeUserId]
	);

	return Number(rows[0]?.count ?? 0) > 0;
};

/**
 * The referrer's authoritative prior credited count for one redemption:
 * armed redemptions (within_referrer_cap decided true) redeemed strictly
 * BEFORE this row, tie-broken by referee id. The prior-only ordering makes a
 * row's diminishing-curve tier stable regardless of when settlement runs; a
 * later redemption can never retroactively shrink an earlier row's reward.
 */
const countPriorReferrerCredits = async ({
	referrerUserId,
	refereeUserId,
	redeemedAtMs
}: {
	referrerUserId: string;
	refereeUserId: string;
	redeemedAtMs: number;
}): Promise<number> => {
	const rows = await query<{ count: string }>(
		`select count(*)::text as count from referrals
		 where referrer_user_id = $1
		   and within_referrer_cap = true
		   and referee_user_id <> $2
		   and (redeemed_at_ms < $3 or (redeemed_at_ms = $3 and referee_user_id::text < $2::text))`,
		[referrerUserId, refereeUserId, redeemedAtMs]
	);

	return Number(rows[0]?.count ?? 0);
};

export interface SettleReferralResult {
	settled: boolean;
	reason?: 'no_referral' | 'not_traded_yet';
}

/**
 * Drives both referral payouts for a single referee row. Idempotent and
 * retry-safe: each side's award key collides once granted, the cap decision
 * is write-once (the guarded update only lands while undecided), and a
 * transfer failure leaves the award row for reconciliation. Safe to call
 * repeatedly from the trade-activity trigger and the manual settle endpoint.
 */
export const settleReferralPayout = async ({
	refereeUserId
}: {
	refereeUserId: string;
}): Promise<SettleReferralResult> => {
	const row = await getReferralRow(refereeUserId);

	if (isNullish(row)) {
		return { settled: false, reason: 'no_referral' };
	}

	if (!(await refereeHasTraded(refereeUserId))) {
		return { settled: false, reason: 'not_traded_yet' };
	}

	// Referee side: flat bonus, server-authoritative amount.
	await grantAward({
		userId: refereeUserId,
		awardType: 'referral',
		awardKey: refereeUserId,
		amountBaseUnits: REFERRAL_VXP_BONUS_BASE_UNITS,
		memo: 'vxp:referral:referee'
	});

	// Referrer side: decide the cap slot once (write-once via the null guard),
	// then pay the curve reward for this row's stable prior count.
	const priorCount = await countPriorReferrerCredits({
		referrerUserId: row.referrer_user_id,
		refereeUserId,
		redeemedAtMs: Number(row.redeemed_at_ms)
	});
	const reward = referrerRewardBaseUnits(priorCount);

	if (isNullish(row.within_referrer_cap)) {
		await query(
			`update referrals set within_referrer_cap = $2
			 where referee_user_id = $1 and within_referrer_cap is null`,
			[refereeUserId, reward > ZERO]
		);

		if (reward <= ZERO) {
			logger.info(
				`referral over cap: referrer ${row.referrer_user_id}, referee ${refereeUserId}, prior ${priorCount}`
			);
		}
	}

	const decided = await getReferralRow(refereeUserId);

	if (decided?.within_referrer_cap === true && reward > ZERO) {
		await grantAward({
			userId: row.referrer_user_id,
			awardType: 'referral',
			awardKey: refereeUserId,
			amountBaseUnits: reward,
			memo: 'vxp:referral:referrer'
		});
	}

	return { settled: true };
};

/**
 * Trade-activity trigger: settles the referred user's bonus on their first
 * prediction. Best-effort by contract: a settle hiccup must not break the
 * activity write or the onboarding payout composed on the same trigger.
 */
export const runReferralTradeTrigger = async ({ userId }: { userId: string }): Promise<void> => {
	try {
		await settleReferralPayout({ refereeUserId: userId });
	} catch (err) {
		logger.error(`referral settle trigger failed for ${userId}:`, err);
	}
};

/** Test/ETL helper and the redeem path's write shape: records a redemption
 * row; the payout is settled later by the triggers above. */
export const recordReferralRedemption = async ({
	refereeUserId,
	referrerUserId,
	code,
	redeemedAtMs
}: {
	refereeUserId: string;
	referrerUserId: string;
	code: string;
	redeemedAtMs?: number;
}): Promise<void> => {
	await query(
		`insert into referrals (referee_user_id, referrer_user_id, code, redeemed_at_ms)
		 values ($1, $2, $3, $4)
		 on conflict (referee_user_id) do nothing`,
		[refereeUserId, referrerUserId, code, redeemedAtMs ?? Date.now()]
	);
};
