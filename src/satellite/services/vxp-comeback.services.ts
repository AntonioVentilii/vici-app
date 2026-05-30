import { ZERO } from '$lib/constants/app.constants';
import { VXP_LEDGER_CANISTER_ID } from '$lib/constants/canisters.constants';
import { Collection } from '$lib/constants/collections.constants';
import { VXP_COMEBACK_GRANT } from '$lib/constants/vxp-economy.constants';
import { vxpAwardKey, type VxpAwardDoc } from '$lib/types/vxp-award';
import type { VxpOnboardingDoc } from '$lib/types/vxp-onboarding';
import { logError, logInfo } from '$satellite/utils/logger.utils';
import { isNullish, jsonReplacer, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import {
	IcrcLedgerCanister,
	type Account,
	type TransferError
} from '@junobuild/functions/canisters/ledger/icrc';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import { decodeDocData, encodeDocData, getDocStore, setDocStore } from '@junobuild/functions/sdk';

/**
 * "Comeback grant" — a one-shot +1000 VXP payout fired the first
 * time a user's balance hits zero, provided they've actually engaged
 * with the app (≥1 paid VXP-onboarding milestone). Without the
 * engagement gate a brand-new account would claim the grant before
 * doing anything, defeating the design (it's meant for someone who
 * spent down their balance, not a fresh signup).
 *
 * Trigger is FE-driven: the user's client detects balance == 0 (the
 * existing wallet store does this already), shows the "claim comeback"
 * affordance, and calls this update endpoint. Server validates the
 * preconditions and fires the transfer.
 *
 * Idempotency is structural via the \`vxp_awards\` collection — the
 * award doc key is \`{recipient}/comeback/comeback\` so a second
 * invocation either returns the prior result (if the first paid) or
 * the prior failure (so the client can retry, but only after the
 * \`failed\` doc has been cleared by an admin / future repair script).
 */

const COMEBACK_AWARD_KEY = 'comeback';

/**
 * Result returned to the caller. Lets the FE distinguish the four
 * cases (paid now / already paid / not eligible because of balance /
 * not eligible because of engagement) and render accordingly.
 */
export interface ComebackClaimResult {
	/** Whether the call resulted in a fresh payout this invocation. */
	paidNow: boolean;
	/** Whether a paid award exists (now or previously). */
	previouslyPaid: boolean;
	/** Ledger block index of the payout, decimal string, if paid. */
	blockIndex?: string;
	/** Machine-readable reason when not eligible. */
	reason?:
		| 'already_claimed_paid'
		| 'already_claimed_pending'
		| 'already_claimed_failed'
		| 'balance_not_zero'
		| 'not_engaged_yet'
		| 'transfer_failed';
	/** Free-form error message when \`reason === 'transfer_failed'\`. */
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

const transferGrant = async ({
	ledger,
	toOwner,
	amount
}: {
	ledger: IcrcLedgerCanister;
	toOwner: Principal;
	amount: bigint;
}): Promise<{ ok: true; blockIndex: bigint } | { ok: false; error: string }> => {
	const to: Account = { owner: toOwner };
	const memoBytes = new TextEncoder().encode('vxp:comeback');

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
 * Engagement gate: the user has at least one paid VXP-onboarding
 * milestone (m1 / m2 / m3). Cheap proxy for "this user has actually
 * used the app" — much simpler than threading a separate flag through
 * the profile or activities collections.
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
 * Caller-invoked endpoint. Returns the structured result above; never
 * throws on expected ineligibility (the FE renders the reason). Throws
 * only on unexpected satellite-internal failures so the runtime maps
 * them to canister errors for the client.
 */
export const claimComebackGrantFn = async (): Promise<ComebackClaimResult> => {
	const callerPrincipal = msgCaller();
	const caller = callerPrincipal.toUint8Array();
	const recipient = callerPrincipal.toText();
	const docKey = vxpAwardKey({
		recipient,
		awardType: 'comeback',
		awardKey: COMEBACK_AWARD_KEY
	});

	// 1. Idempotency — short-circuit if an award doc already exists.
	const existing = getDocStore({
		collection: Collection.VXP_AWARDS,
		key: docKey,
		caller
	});

	if (nonNullish(existing)) {
		const doc = decodeDocData<VxpAwardDoc>(existing.data);

		if (doc.status === 'paid') {
			return {
				paidNow: false,
				previouslyPaid: true,
				blockIndex: doc.blockIndex,
				reason: 'already_claimed_paid'
			};
		}

		// \`pending\` here means a prior call started the transfer but the
		// satellite died before flipping the doc to terminal; treat as
		// "wait, do not retry from the client" — the next invocation
		// after the doc is reconciled by a repair script will succeed.
		// \`failed\` similarly stays terminal; clearing it for retry is an
		// admin op, not a client one.
		return {
			paidNow: false,
			previouslyPaid: false,
			reason: doc.status === 'pending' ? 'already_claimed_pending' : 'already_claimed_failed'
		};
	}

	// 2. Engagement gate.
	if (!hasEngaged({ caller, userKey: recipient })) {
		return {
			paidNow: false,
			previouslyPaid: false,
			reason: 'not_engaged_yet'
		};
	}

	// 3. Balance gate — must be exactly zero ("balance hits 0").
	const ledger = new IcrcLedgerCanister({
		canisterId: Principal.fromText(VXP_LEDGER_CANISTER_ID)
	});
	const balance = await ledger.icrc1BalanceOf({
		account: { owner: callerPrincipal }
	});

	if (balance > ZERO) {
		return {
			paidNow: false,
			previouslyPaid: false,
			reason: 'balance_not_zero'
		};
	}

	// 4. Persist pending award. Collision (concurrent invocation
	// already wrote it) means we stop here — the other path will run
	// the transfer.
	const amount = BigInt(VXP_COMEBACK_GRANT);
	const earnedAtMs = Date.now();
	const pending: VxpAwardDoc = {
		recipient,
		awardType: 'comeback',
		awardKey: COMEBACK_AWARD_KEY,
		amountBaseUnits: amount.toString(),
		status: 'pending',
		earnedAtMs
	};

	try {
		setDocStore({
			caller,
			collection: Collection.VXP_AWARDS,
			key: docKey,
			doc: { data: encodeDocData(pending) }
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);

		logInfo({
			message: 'comeback_pending_blocked',
			detail: { user: recipient, error: msg }
		});

		return {
			paidNow: false,
			previouslyPaid: false,
			reason: 'already_claimed_pending'
		};
	}

	// 5. Transfer + reconcile.
	const result = await transferGrant({
		ledger,
		toOwner: callerPrincipal,
		amount
	});

	const latest = getDocStore({
		collection: Collection.VXP_AWARDS,
		key: docKey,
		caller
	});

	if (result.ok) {
		logInfo({
			message: 'comeback_paid',
			detail: {
				user: recipient,
				amount: amount.toString(),
				block_index: result.blockIndex.toString()
			}
		});

		if (nonNullish(latest)) {
			const latestDoc = decodeDocData<VxpAwardDoc>(latest.data);
			const paid: VxpAwardDoc = {
				...latestDoc,
				status: 'paid',
				paidAtMs: Date.now(),
				blockIndex: result.blockIndex.toString()
			};

			setDocStore({
				caller,
				collection: Collection.VXP_AWARDS,
				key: docKey,
				doc: { data: encodeDocData(paid), version: latest.version }
			});
		}

		return {
			paidNow: true,
			previouslyPaid: false,
			blockIndex: result.blockIndex.toString()
		};
	}

	logError({
		message: 'comeback_failed',
		detail: { user: recipient, amount: amount.toString(), error: result.error }
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
		paidNow: false,
		previouslyPaid: false,
		reason: 'transfer_failed',
		errorMessage: result.error
	};
};
