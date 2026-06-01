import type { ClearingDid } from '$declarations';
import { ZERO } from '$lib/constants/app.constants';
import {
	CLEARING_CANISTER_ID,
	REGISTRY_CANISTER_ID,
	VXP_LEDGER_CANISTER_ID
} from '$lib/constants/canisters.constants';
import { Collection } from '$lib/constants/collections.constants';
import { VICI_ENGINE_ID } from '$lib/constants/icdc.constants';
import {
	CALIBRATION_DAILY_CAP,
	CALIBRATION_HOURLY_CAP,
	CALIBRATION_RECOVERY_FLOOR,
	VXP_CALIBRATION_REWARD
} from '$lib/constants/vxp-economy.constants';
import type { CallSide } from '$lib/types/market';
import { vxpAwardKey, type VxpAwardDoc } from '$lib/types/vxp-award';
import type { VxpOnboardingDoc } from '$lib/types/vxp-onboarding';
import { logError, logInfo } from '$satellite/utils/logger.utils';
import { isNullish, jsonReplacer, nonNullish } from '@dfinity/utils';
import { IDL } from '@icp-sdk/core/candid';
import { Principal } from '@icp-sdk/core/principal';
import {
	IcrcLedgerCanister,
	type Account,
	type TransferError
} from '@junobuild/functions/canisters/ledger/icrc';
import { call, msgCaller, time } from '@junobuild/functions/ic-cdk';
import {
	decodeDocData,
	encodeDocData,
	getDocStore,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';

/**
 * Calibration reward — a fixed VXP bonus paid the first time a
 * *recovering* user correctly calls a finalised Vici binary market.
 *
 * The product intent: a user who has spent their balance down stays
 * engaged by reading markets right. The reward is small, fixed, and
 * only fires while the caller's available balance is below the recovery
 * floor — so it nudges depleted users back into the loop without paying
 * out to anyone with a healthy balance.
 *
 * Because this mints real on-chain VXP, every gate is enforced
 * server-side and the winning side is re-derived from the clearing
 * settlement — the FE-supplied `chosenSide` is only compared, never
 * trusted to define correctness. The caller can therefore never forge a
 * win. A wrong guess returns `{ correct: false }`, writes no award doc,
 * and applies no penalty.
 *
 * Idempotency and rate limiting both come off the `vxp_awards`
 * collection (no new collection): the per-market award doc key
 * `{caller}/calibration/{seriesId}` makes a second claim on the same
 * market a collision, and the caller's `calibration` docs are counted by
 * key prefix to enforce the rolling hourly / daily caps.
 */

const CALIBRATION_AWARD_TYPE = 'calibration';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Binary settlement is a `Price`; the engine rule is `price > 0 ⇒ YES`. */
const PriceIdl = IDL.Record({
	timestamp: IDL.Opt(IDL.Nat64),
	oracle_id: IDL.Opt(IDL.Text),
	decimal: IDL.Record({ decimals: IDL.Nat8, value: IDL.Nat })
});

const SettlementInputIdl = IDL.Variant({
	Price: PriceIdl,
	Outcome: IDL.Text
});

const PlanStatusIdl = IDL.Variant({
	Finalised: IDL.Null,
	Planned: IDL.Null,
	Executing: IDL.Null
});

const BalanceDomainIdl = IDL.Variant({
	ViciXp: IDL.Null,
	Social: IDL.Null,
	Playground: IDL.Null,
	Settlement: IDL.Null
});

const SettlementStatusViewIdl = IDL.Record({
	status: PlanStatusIdl,
	series_id: IDL.Text,
	fee_usd: IDL.Nat,
	accounting_cursor: IDL.Nat64,
	insurance_fee_usd: IDL.Nat,
	accounting_applied: IDL.Bool,
	balance_domain: BalanceDomainIdl,
	oracle_source: IDL.Text,
	total_positions: IDL.Nat64,
	settlement: SettlementInputIdl
});

/** Only the two fields the market gate needs are decoded from `Series`. */
const PayoffTypeIdl = IDL.Variant({
	Put: IDL.Null,
	Binary: IDL.Null,
	Call: IDL.Null,
	Categorical: IDL.Null
});

const SeriesGateIdl = IDL.Record({
	engine_id: IDL.Opt(IDL.Text),
	payoff_type: PayoffTypeIdl
});

type CalibrationReason =
	| 'anonymous'
	| 'not_engaged_yet'
	| 'balance_above_floor'
	| 'not_vici_market'
	| 'not_binary'
	| 'not_finalised'
	| 'outcome_undetermined'
	| 'rate_limited_hourly'
	| 'rate_limited_daily'
	| 'transfer_failed';

/**
 * Structured result the FE switches on. `correct` is the calibration
 * outcome (independent of payout); `paidNow` / `alreadyClaimed` cover
 * the reward state; `reason` carries the machine-readable ineligibility
 * when nothing was paid.
 */
export interface CalibrationRewardResult {
	correct: boolean;
	paidNow: boolean;
	alreadyClaimed: boolean;
	rewardBaseUnits?: string;
	newBalanceBaseUnits?: string;
	blockIndex?: string;
	reason?: CalibrationReason;
	errorMessage?: string;
}

const transferErrorText = (err: TransferError): string => {
	if ('InsufficientFunds' in err) {
		return `InsufficientFunds(balance=${err.InsufficientFunds.balance})`;
	}

	if ('BadFee' in err) {
		return `BadFee(expected_fee=${err.BadFee.expected_fee})`;
	}

	return JSON.stringify(err, jsonReplacer);
};

const transferReward = async ({
	ledger,
	toOwner,
	amount,
	seriesId
}: {
	ledger: IcrcLedgerCanister;
	toOwner: Principal;
	amount: bigint;
	seriesId: string;
}): Promise<{ ok: true; blockIndex: bigint } | { ok: false; error: string }> => {
	const to: Account = { owner: toOwner };
	const memoBytes = new TextEncoder().encode(`vxp:calibration:${seriesId}`);

	const tryTransfer = (fee?: bigint) =>
		ledger.icrc1Transfer({
			args: { to, amount, fee, memo: memoBytes }
		});

	const firstAttempt = await tryTransfer();
	const finalAttempt =
		'Err' in firstAttempt && 'BadFee' in firstAttempt.Err
			? await tryTransfer(firstAttempt.Err.BadFee.expected_fee)
			: firstAttempt;

	if ('Ok' in finalAttempt) {
		return { ok: true, blockIndex: finalAttempt.Ok };
	}

	return { ok: false, error: transferErrorText(finalAttempt.Err) };
};

/**
 * Engagement gate: the caller has at least one paid VXP-onboarding
 * milestone (m1 / m2 / m3). Cheap proxy for "this user has actually
 * used the app", so a fresh signup can't farm rewards. Mirrors the
 * onboarding read used by the other award paths.
 */
const hasEngaged = ({ caller, userKey }: { caller: Uint8Array; userKey: string }): boolean => {
	const onboardingDoc = getDocStore({
		collection: Collection.VXP_ONBOARDING,
		key: userKey,
		caller
	});

	if (isNullish(onboardingDoc)) {
		return false;
	}

	const doc = decodeDocData<VxpOnboardingDoc>(onboardingDoc.data);

	return (
		doc.milestones.m1.status === 'paid' ||
		doc.milestones.m2.status === 'paid' ||
		doc.milestones.m3.status === 'paid'
	);
};

/**
 * Vici-market gate: the series must be created by the Vici engine
 * (`engine_id == opt "eng_0"`) and carry a Binary payoff. Returns the
 * reason to reject with, or `undefined` when the gate passes.
 */
const checkMarketShape = async (seriesId: string): Promise<CalibrationReason | undefined> => {
	const result = await call<
		[] | [{ engine_id: [] | [string]; payoff_type: ClearingDid.PayoffType }]
	>({
		canisterId: REGISTRY_CANISTER_ID,
		method: 'get_series',
		args: [[IDL.Text, seriesId]],
		result: IDL.Opt(SeriesGateIdl)
	});

	const [series] = result;

	if (isNullish(series)) {
		return 'not_vici_market';
	}

	const [engineId] = series.engine_id;

	if (engineId !== VICI_ENGINE_ID) {
		return 'not_vici_market';
	}

	if (!('Binary' in series.payoff_type)) {
		return 'not_binary';
	}
};

/**
 * Resolution gate: the clearing settlement plan must be Finalised, and
 * the binary settlement price must resolve to a definite side. Returns
 * the winning side, or a rejection reason. The engine's binary rule is
 * `price > 0 ⇒ YES else NO`; a missing settlement / non-price
 * settlement leaves the outcome undetermined.
 */
const deriveWinningSide = async (
	seriesId: string
): Promise<{ side: CallSide } | { reason: CalibrationReason }> => {
	const result = await call<[] | [ClearingDid.SettlementStatusView]>({
		canisterId: CLEARING_CANISTER_ID,
		method: 'get_settlement_status',
		args: [[IDL.Text, seriesId]],
		result: IDL.Opt(SettlementStatusViewIdl)
	});

	const [view] = result;

	if (isNullish(view)) {
		return { reason: 'not_finalised' };
	}

	if (!('Finalised' in view.status)) {
		return { reason: 'not_finalised' };
	}

	if (!('Price' in view.settlement)) {
		return { reason: 'outcome_undetermined' };
	}

	return { side: view.settlement.Price.decimal.value > ZERO ? 'YES' : 'NO' };
};

/**
 * Rate-limit gate. Counts the caller's `calibration` award docs whose
 * Juno-managed `created_at` falls within the rolling 1h / 24h windows.
 * `created_at` (not the in-body `earnedAtMs`) is the boundary because it
 * is stamped by the datastore on write and can't be set by the caller.
 * Returns the breached reason, or `undefined` when both caps allow one
 * more reward.
 */
const checkRateLimits = ({
	caller,
	recipient,
	nowMs
}: {
	caller: Uint8Array;
	recipient: string;
	nowMs: number;
}): CalibrationReason | undefined => {
	// The award docs are keyed `{recipient}/calibration/{seriesId}`, so the
	// builder with an empty `awardKey` yields this caller's calibration key
	// prefix. `matcher.key` is matched as a regex by the datastore, so
	// anchor it to the start to restrict the store-level scan to just this
	// caller's calibration docs instead of listing the whole collection.
	const prefix = vxpAwardKey({ recipient, awardType: CALIBRATION_AWARD_TYPE, awardKey: '' });
	const hourCutoffNs = BigInt(nowMs - HOUR_MS) * 1_000_000n;
	const dayCutoffNs = BigInt(nowMs - DAY_MS) * 1_000_000n;

	const { items } = listDocsStore({
		collection: Collection.VXP_AWARDS,
		caller,
		params: {
			matcher: {
				key: `^${prefix}`,
				// Docs outside the rolling day window can't count toward either
				// cap, so bound the scan at the store level too.
				created_at: { greater_than: dayCutoffNs }
			},
			// Newest first, so once the hourly cap is reached we can stop.
			order: { desc: true, field: 'created_at' }
		}
	});

	let hourCount = 0;
	let dayCount = 0;

	for (const [, item] of items) {
		const createdAtNs = item.created_at;

		// The store matcher already bounds to the day window; the guard is
		// defensive in case `created_at` is ever absent.
		if (nonNullish(createdAtNs) && createdAtNs >= dayCutoffNs) {
			dayCount += 1;

			if (createdAtNs >= hourCutoffNs) {
				hourCount += 1;
			}
		}

		// Ordered newest-first: once the hourly cap is met the rest can't
		// change the hourly outcome, so stop scanning early.
		if (hourCount >= CALIBRATION_HOURLY_CAP) {
			break;
		}
	}

	if (hourCount >= CALIBRATION_HOURLY_CAP) {
		return 'rate_limited_hourly';
	}

	if (dayCount >= CALIBRATION_DAILY_CAP) {
		return 'rate_limited_daily';
	}
};

/**
 * Caller-invoked endpoint. Returns the structured result above; never
 * throws on expected ineligibility (the FE renders the reason). Throws
 * only on unexpected satellite-internal failures so the runtime maps
 * them to canister errors for the client.
 */
export const claimCalibrationRewardFn = async ({
	seriesId,
	chosenSide
}: {
	seriesId: string;
	chosenSide: CallSide;
}): Promise<CalibrationRewardResult> => {
	const callerPrincipal = msgCaller();

	// 1. Anonymous principal can never earn a reward.
	if (callerPrincipal.isAnonymous()) {
		return { correct: false, paidNow: false, alreadyClaimed: false, reason: 'anonymous' };
	}

	const caller = callerPrincipal.toUint8Array();
	const recipient = callerPrincipal.toText();
	const docKey = vxpAwardKey({
		recipient,
		awardType: CALIBRATION_AWARD_TYPE,
		awardKey: seriesId
	});

	// 6 (early). Per-market dedupe — any prior award doc for this market
	// short-circuits before any cross-canister work. Already-claimed
	// markets report `correct: true` (the reward only exists when the
	// call was right) without re-paying.
	const existing = getDocStore({
		collection: Collection.VXP_AWARDS,
		key: docKey,
		caller
	});

	if (nonNullish(existing)) {
		return { correct: true, paidNow: false, alreadyClaimed: true };
	}

	// 2. Engagement gate.
	if (!hasEngaged({ caller, userKey: recipient })) {
		return { correct: false, paidNow: false, alreadyClaimed: false, reason: 'not_engaged_yet' };
	}

	// 3. Balance floor — the core bound: pay only while recovering.
	const ledger = new IcrcLedgerCanister({
		canisterId: Principal.fromText(VXP_LEDGER_CANISTER_ID)
	});
	const balance = await ledger.icrc1BalanceOf({
		account: { owner: callerPrincipal }
	});

	if (balance >= BigInt(CALIBRATION_RECOVERY_FLOOR)) {
		return { correct: false, paidNow: false, alreadyClaimed: false, reason: 'balance_above_floor' };
	}

	// 4. Vici-market gate — engine eng_0 + Binary payoff.
	const marketReason = await checkMarketShape(seriesId);

	if (nonNullish(marketReason)) {
		return { correct: false, paidNow: false, alreadyClaimed: false, reason: marketReason };
	}

	// 5. Resolution gate — Finalised + derive the winning side.
	const resolution = await deriveWinningSide(seriesId);

	if ('reason' in resolution) {
		return { correct: false, paidNow: false, alreadyClaimed: false, reason: resolution.reason };
	}

	const correct = chosenSide === resolution.side;

	// 8 (wrong path). A wrong call mints nothing, writes no doc, applies
	// no penalty. Returned before the rate-limit check so a wrong guess
	// doesn't consume the user's hourly / daily budget.
	if (!correct) {
		return { correct: false, paidNow: false, alreadyClaimed: false };
	}

	const nowMs = Number(time() / 1_000_000n);

	// 7. Rate limits — rolling 1h / 24h windows off `created_at`.
	const rateReason = checkRateLimits({ caller, recipient, nowMs });

	if (nonNullish(rateReason)) {
		return { correct: true, paidNow: false, alreadyClaimed: false, reason: rateReason };
	}

	// 8 (correct path). Persist the pending award, transfer, reconcile.
	const amount = BigInt(VXP_CALIBRATION_REWARD);
	const pending: VxpAwardDoc = {
		recipient,
		awardType: CALIBRATION_AWARD_TYPE,
		awardKey: seriesId,
		amountBaseUnits: amount.toString(),
		status: 'pending',
		earnedAtMs: nowMs
	};

	try {
		setDocStore({
			caller,
			collection: Collection.VXP_AWARDS,
			key: docKey,
			doc: { data: encodeDocData(pending) }
		});
	} catch (e: unknown) {
		// A concurrent invocation already wrote the pending doc — treat as
		// already-claimed rather than double-paying.
		const msg = e instanceof Error ? e.message : String(e);

		logInfo({
			message: 'calibration_pending_blocked',
			detail: { user: recipient, series_id: seriesId, error: msg }
		});

		return { correct: true, paidNow: false, alreadyClaimed: true };
	}

	const result = await transferReward({ ledger, toOwner: callerPrincipal, amount, seriesId });

	const latest = getDocStore({
		collection: Collection.VXP_AWARDS,
		key: docKey,
		caller
	});

	if (result.ok) {
		logInfo({
			message: 'calibration_paid',
			detail: {
				user: recipient,
				series_id: seriesId,
				amount: amount.toString(),
				block_index: result.blockIndex.toString()
			}
		});

		if (nonNullish(latest)) {
			const latestDoc = decodeDocData<VxpAwardDoc>(latest.data);
			const paid: VxpAwardDoc = {
				...latestDoc,
				status: 'paid',
				paidAtMs: nowMs,
				blockIndex: result.blockIndex.toString()
			};

			setDocStore({
				caller,
				collection: Collection.VXP_AWARDS,
				key: docKey,
				doc: { data: encodeDocData(paid), version: latest.version }
			});
		}

		const newBalance = await ledger.icrc1BalanceOf({
			account: { owner: callerPrincipal }
		});

		return {
			correct: true,
			paidNow: true,
			alreadyClaimed: false,
			rewardBaseUnits: amount.toString(),
			newBalanceBaseUnits: newBalance.toString(),
			blockIndex: result.blockIndex.toString()
		};
	}

	logError({
		message: 'calibration_failed',
		detail: {
			user: recipient,
			series_id: seriesId,
			amount: amount.toString(),
			error: result.error
		}
	});

	if (nonNullish(latest)) {
		const latestDoc = decodeDocData<VxpAwardDoc>(latest.data);
		const failed: VxpAwardDoc = {
			...latestDoc,
			status: 'failed',
			errorMessage: result.error
		};

		setDocStore({
			caller,
			collection: Collection.VXP_AWARDS,
			key: docKey,
			doc: { data: encodeDocData(failed), version: latest.version }
		});
	}

	return {
		correct: true,
		paidNow: false,
		alreadyClaimed: false,
		reason: 'transfer_failed',
		errorMessage: result.error
	};
};
