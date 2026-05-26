import { VXP_LEDGER_CANISTER_ID } from '$lib/constants/canisters.constants';
import { Collection } from '$lib/constants/collections.constants';
import { VXP_STREAK_BONUSES } from '$lib/constants/vxp-economy.constants';
import { vxpAwardKey, type VxpAwardDoc } from '$lib/types/vxp-award';
import { logError, logInfo } from '$satellite/utils/logger.utils';
import { isNullish, jsonReplacer, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import type { OnSetDocContext } from '@junobuild/functions';
import {
	IcrcLedgerCanister,
	type Account,
	type TransferError
} from '@junobuild/functions/canisters/ledger/icrc';
import { decodeDocData, encodeDocData, getDocStore, setDocStore } from '@junobuild/functions/sdk';

/**
 * Streak-milestone hook. Runs after every `profiles` write; when the
 * user's `dailyStreak` crosses one of the milestone boundaries
 * (3 / 7 / 14 / 30), credits the corresponding VXP bonus to their
 * ledger account and persists the payout in `vxp_awards`.
 *
 * Idempotency is structural: the award doc key is
 * `${recipient}/streak/streak_${milestone}` — the second hook firing
 * at the same milestone collides with the first and the assert blocks
 * the duplicate write. No timestamp-based dedupe needed.
 *
 * Composes alongside `onProfileSetForVxpOnboarding` and
 * `onProfileSetForReferralCode` in the profile dispatch table.
 */

const STREAK_MILESTONES: readonly number[] = Object.freeze(
	Object.keys(VXP_STREAK_BONUSES)
		.map((k) => Number(k))
		.sort((a, b) => a - b)
);

/**
 * Subset of the profile shape the streak hook actually reads. Decoded
 * from the satellite doc payload — full `UserProfile` isn't needed.
 */
interface DailyStreakSlice {
	dailyStreak?: number;
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

const transferBonus = async ({
	ledger,
	toOwner,
	amount,
	memoLabel
}: {
	ledger: IcrcLedgerCanister;
	toOwner: Principal;
	amount: bigint;
	memoLabel: string;
}): Promise<{ ok: true; blockIndex: bigint } | { ok: false; error: string }> => {
	const to: Account = { owner: toOwner };
	const memoBytes = new TextEncoder().encode(`vxp:streak:${memoLabel}`);

	const tryTransfer = (fee?: bigint) =>
		ledger.icrc1Transfer({
			args: {
				to,
				amount,
				fee,
				memo: memoBytes
			}
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
 * Milestone boundaries the user's streak just crossed on this write.
 * Returns an empty array if neither end is set or no boundary was
 * crossed (the common case — most writes don't bump streak).
 */
const milestonesCrossed = ({ prev, next }: { prev: number; next: number }): number[] => {
	if (next <= prev) {
		return [];
	}

	return STREAK_MILESTONES.filter((m) => prev < m && m <= next);
};

const streakAwardKey = (milestone: number): string => `streak_${milestone}`;

const persistAward = ({
	caller,
	recipient,
	awardKey,
	doc
}: {
	caller: Uint8Array;
	recipient: string;
	awardKey: string;
	doc: VxpAwardDoc;
}): void => {
	const key = vxpAwardKey({ recipient, awardType: 'streak', awardKey });

	setDocStore({
		caller,
		collection: Collection.VXP_AWARDS,
		key,
		doc: {
			data: encodeDocData(doc)
		}
	});
};

const updateAward = ({
	caller,
	recipient,
	awardKey,
	patch
}: {
	caller: Uint8Array;
	recipient: string;
	awardKey: string;
	patch: Partial<VxpAwardDoc> & Pick<VxpAwardDoc, 'status'>;
}): void => {
	const key = vxpAwardKey({ recipient, awardType: 'streak', awardKey });
	const existing = getDocStore({
		collection: Collection.VXP_AWARDS,
		key,
		caller
	});

	if (isNullish(existing)) {
		return;
	}

	const existingDoc = decodeDocData<VxpAwardDoc>(existing.data);
	const next: VxpAwardDoc = { ...existingDoc, ...patch };

	setDocStore({
		caller,
		collection: Collection.VXP_AWARDS,
		key,
		doc: {
			data: encodeDocData(next),
			version: existing.version
		}
	});
};

const payStreakMilestone = async ({
	ledger,
	caller,
	recipient,
	milestone
}: {
	ledger: IcrcLedgerCanister;
	caller: Uint8Array;
	recipient: string;
	milestone: number;
}): Promise<void> => {
	const amount = BigInt(VXP_STREAK_BONUSES[milestone]);
	const awardKey = streakAwardKey(milestone);
	const earnedAtMs = Date.now();

	// Idempotency: if the award doc already exists, skip — the assert
	// rejects duplicate creations anyway, but checking up front avoids
	// the wasted ledger call.
	const existingKey = vxpAwardKey({ recipient, awardType: 'streak', awardKey });
	const existing = getDocStore({
		collection: Collection.VXP_AWARDS,
		key: existingKey,
		caller
	});

	if (nonNullish(existing)) {
		return;
	}

	const pending: VxpAwardDoc = {
		recipient,
		awardType: 'streak',
		awardKey,
		amountBaseUnits: amount.toString(),
		status: 'pending',
		earnedAtMs
	};

	try {
		persistAward({ caller, recipient, awardKey, doc: pending });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);

		// Most likely cause: a concurrent hook firing already wrote the
		// pending doc. Either way, surface and stop — the other hook will
		// (or has already) issued the transfer.
		logInfo({
			message: 'streak_award_pending_blocked',
			detail: { user: recipient, milestone, error: msg }
		});

		return;
	}

	const result = await transferBonus({
		ledger,
		toOwner: Principal.fromText(recipient),
		amount,
		memoLabel: awardKey
	});

	if (result.ok) {
		logInfo({
			message: 'streak_award_paid',
			detail: {
				user: recipient,
				milestone,
				amount: amount.toString(),
				block_index: result.blockIndex.toString()
			}
		});

		updateAward({
			caller,
			recipient,
			awardKey,
			patch: {
				status: 'paid',
				paidAtMs: Date.now(),
				blockIndex: result.blockIndex.toString()
			}
		});

		return;
	}

	logError({
		message: 'streak_award_failed',
		detail: {
			user: recipient,
			milestone,
			amount: amount.toString(),
			error: result.error
		}
	});

	updateAward({
		caller,
		recipient,
		awardKey,
		patch: {
			status: 'failed',
			errorMessage: result.error
		}
	});
};

/**
 * Profile post-write hook — composes alongside the other `profiles`
 * hooks in `satellite/index.ts`. Detects daily-streak milestone
 * crossings and credits the matching VXP bonus.
 */
export const onProfileSetForStreakAward = async (ctx: OnSetDocContext): Promise<void> => {
	const {
		caller,
		data: {
			collection,
			key,
			data: { before, after }
		}
	} = ctx;

	try {
		if (collection !== Collection.PROFILES) {
			return;
		}

		const callerText = Principal.fromUint8Array(caller).toText();

		// Only react to the user writing their own profile.
		if (key !== callerText) {
			return;
		}

		const prevDoc = nonNullish(before) ? decodeDocData<DailyStreakSlice>(before.data) : undefined;
		const nextDoc = decodeDocData<DailyStreakSlice>(after.data);

		const prev = prevDoc?.dailyStreak ?? 0;
		const next = nextDoc.dailyStreak ?? 0;
		const crossed = milestonesCrossed({ prev, next });

		if (crossed.length === 0) {
			return;
		}

		const ledger = new IcrcLedgerCanister({
			canisterId: Principal.fromText(VXP_LEDGER_CANISTER_ID)
		});

		for (const milestone of crossed) {
			await payStreakMilestone({
				ledger,
				caller,
				recipient: callerText,
				milestone
			});
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		const user = key.length > 0 ? key : Principal.fromUint8Array(caller).toText();

		logError({
			message: 'hook_error',
			detail: { hook: 'streak_award', user, error: msg }
		});

		throw e;
	}
};
