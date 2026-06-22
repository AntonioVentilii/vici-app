// TEMPORARY one-off remediation — DO NOT COMMIT / DO NOT LEAVE WIRED.
//
// Backfills the streak-award underpayment fixed in #957. Before the fix,
// `payStreakMilestone` transferred `BigInt(VXP_STREAK_BONUSES[m])` (whole
// VXP read as base units) instead of `parseToken(...)`, so every streak
// award paid ~10^VXP_TOKEN.decimals too little. This walks the paid
// `vxp_awards` streak docs, computes each shortfall, and (when not a dry
// run) mints the difference to the recipient.
//
// Idempotent: it writes a marker award doc keyed `streak_<m>_backfill`
// per remediated award, so a re-run skips anything already topped up. It
// only touches docs whose recorded `amountBaseUnits` is BELOW the correct
// base-unit amount, so correctly-paid (post-fix) awards are left alone.
//
// Runbook (mainnet):
//   1. Wire `backfillStreakUnderpayments` into index.ts as a defineUpdate
//      (admin-gated handler below already enforces the caller).
//   2. `npm run juno:functions:build`; deploy the satellite.
//   3. Call with `{ dryRun: true }` → review the report (count + total owed).
//   4. Only if the numbers look right, call with `{ dryRun: false }`.
//   5. Revert steps 1–2 (git checkout) and redeploy the clean wasm. Never
//      commit this file.

import { VXP_TOKEN } from '$lib/constants/tokens/tokens.ic.constants';
import { VXP_STREAK_BONUSES } from '$lib/constants/vxp-economy.constants';
import { Collection } from '$lib/constants/collections.constants';
import { vxpAwardKey, type VxpAwardDoc } from '$lib/types/vxp-award';
import { parseToken } from '$lib/utils/parse.utils';
import { isAdmin } from '$satellite/services/_authz';
import { logError, logInfo } from '$satellite/utils/logger.utils';
import { transferWithBadFeeRetry } from '$satellite/utils/vxp-payout.utils';
import { VXP_LEDGER_CANISTER_ID } from '$lib/constants/canisters.constants';
import { isNullish, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import { IcrcLedgerCanister } from '@junobuild/functions/canisters/ledger/icrc';
import {
	decodeDocData,
	encodeDocData,
	getAdminAccessKeys,
	getDocStore,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';

export interface StreakBackfillReport {
	scanned: number;
	underpaid: number;
	alreadyBackfilled: number;
	minted: number;
	failed: number;
	totalShortfallBaseUnits: string;
}

const MILESTONE_RE = /^streak_(\d+)$/;

const correctBaseUnits = (milestone: number): bigint | null => {
	const whole = VXP_STREAK_BONUSES[milestone];
	if (isNullish(whole)) {
		return null;
	}
	return parseToken({ value: whole.toString(), unitName: VXP_TOKEN.decimals });
};

/**
 * Admin-gated. `dryRun: true` (default) only reports; `dryRun: false`
 * mints shortfalls. Each `setDocStore` is signed with the recipient's own
 * principal as `caller` so the `vxp_awards` assert (recipient binds
 * caller) accepts it — exactly how the streak hook writes its docs.
 */
export const backfillStreakUnderpaymentsFn = async ({
	dryRun = true
}: {
	dryRun?: boolean;
}): Promise<StreakBackfillReport> => {
	if (!isAdmin({ caller: msgCaller() })) {
		throw new Error('backfillStreakUnderpayments: admin only.');
	}

	const ledger = new IcrcLedgerCanister({
		canisterId: Principal.fromText(VXP_LEDGER_CANISTER_ID)
	});

	// Controllers can read the whole collection; use the admin key as the
	// list caller (same pattern as the reaction-count recompute).
	const admin = getAdminAccessKeys()[0]?.[0];
	if (isNullish(admin)) {
		throw new Error('backfillStreakUnderpayments: no admin access key available.');
	}

	const { items } = listDocsStore({
		collection: Collection.VXP_AWARDS,
		caller: admin,
		// Streak award keys are `${recipient}/streak/streak_<m>`; this prefix
		// is matched as a regex, so it scopes the scan to streak awards only.
		params: { matcher: { key: '/streak/streak_' } }
	});

	const report: StreakBackfillReport = {
		scanned: 0,
		underpaid: 0,
		alreadyBackfilled: 0,
		minted: 0,
		failed: 0,
		totalShortfallBaseUnits: '0'
	};
	let totalShortfall = 0n;

	for (const [, item] of items) {
		const doc = decodeDocData<VxpAwardDoc>(item.data);
		if (doc.awardType !== 'streak' || doc.status !== 'paid') {
			continue;
		}
		const m = doc.awardKey.match(MILESTONE_RE);
		if (isNullish(m)) {
			continue; // already a `_backfill` marker or an unexpected key
		}
		report.scanned += 1;

		const correct = correctBaseUnits(Number(m[1]));
		if (isNullish(correct)) {
			continue;
		}
		const paid = BigInt(doc.amountBaseUnits);
		const shortfall = correct - paid;
		if (shortfall <= 0n) {
			continue; // already correct (post-fix payment)
		}

		report.underpaid += 1;
		totalShortfall += shortfall;

		const backfillKey = `${doc.awardKey}_backfill`;
		const recipientBytes = Principal.fromText(doc.recipient).toUint8Array();
		const markerKey = vxpAwardKey({
			recipient: doc.recipient,
			awardType: 'streak',
			awardKey: backfillKey
		});

		const existing = getDocStore({
			collection: Collection.VXP_AWARDS,
			key: markerKey,
			caller: recipientBytes
		});
		if (nonNullish(existing)) {
			report.alreadyBackfilled += 1;
			continue;
		}

		if (dryRun) {
			continue;
		}

		const pending: VxpAwardDoc = {
			recipient: doc.recipient,
			awardType: 'streak',
			awardKey: backfillKey,
			amountBaseUnits: shortfall.toString(),
			status: 'pending',
			earnedAtMs: doc.earnedAtMs
		};
		setDocStore({
			caller: recipientBytes,
			collection: Collection.VXP_AWARDS,
			key: markerKey,
			doc: { data: encodeDocData(pending) }
		});

		const result = await transferWithBadFeeRetry({
			ledger,
			toOwner: Principal.fromText(doc.recipient),
			amount: shortfall,
			memo: `vxp:streak:${backfillKey}`
		});

		const settled: VxpAwardDoc = result.ok
			? { ...pending, status: 'paid', paidAtMs: Date.now(), blockIndex: result.blockIndex.toString() }
			: { ...pending, status: 'failed', errorMessage: result.error };
		setDocStore({
			caller: recipientBytes,
			collection: Collection.VXP_AWARDS,
			key: markerKey,
			doc: { data: encodeDocData(settled), version: 1n }
		});

		if (result.ok) {
			report.minted += 1;
			logInfo({
				message: 'streak_backfill_paid',
				detail: { user: doc.recipient, awardKey: backfillKey, shortfall: shortfall.toString() }
			});
		} else {
			report.failed += 1;
			logError({
				message: 'streak_backfill_failed',
				detail: { user: doc.recipient, awardKey: backfillKey, error: result.error }
			});
		}
	}

	report.totalShortfallBaseUnits = totalShortfall.toString();
	return report;
};
