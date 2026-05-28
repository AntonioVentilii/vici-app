import { VXP_LEDGER_CANISTER_ID } from '$lib/constants/canisters.constants';
import { Collection } from '$lib/constants/collections.constants';
import {
	REFERRAL_CODE_ALPHABET,
	REFERRAL_CODE_LENGTH,
	REFERRAL_CODE_REGEX,
	REFERRAL_EXISTING_USER_REASON,
	REFERRAL_MAX_PAID,
	REFERRAL_SIGNUP_WINDOW_MS,
	REFERRAL_VXP_BONUS_BASE_UNITS
} from '$lib/constants/referral.constants';
import { VXP_REFERRAL_MONTHLY_CAP } from '$lib/constants/vxp-economy.constants';
import { RelationCategory, RelationState } from '$lib/enums/relation';
import type { ReferralCodeDoc, ReferralDoc, ReferralListItem } from '$lib/types/referral';
import type { Relation } from '$lib/types/relation';
import type { VxpMilestoneState } from '$lib/types/vxp-onboarding';
import { logError, logInfo } from '$satellite/utils/logger.utils';
import { isNullish, jsonReplacer, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import type { AssertSetDocContext, OnSetDocContext } from '@junobuild/functions';
import {
	IcrcLedgerCanister,
	type Account,
	type TransferError
} from '@junobuild/functions/canisters/ledger/icrc';
import { msgCaller, time } from '@junobuild/functions/ic-cdk';
import {
	decodeDocData,
	encodeDocData,
	getDocStore,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';
import type { PrincipalText } from '@junobuild/schema';

// ─── Code generation ─────────────────────────────────────────────────────

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;
const ALPHABET_SIZE = BigInt(REFERRAL_CODE_ALPHABET.length);
const CODE_GENERATION_MAX_RETRIES = 8;

/**
 * 64-bit FNV-1a over the input string. Cheap, deterministic, and adequate as the entropy source
 * for an 8-char (40-bit) opaque code — we only need uniqueness across the user base, not
 * cryptographic unpredictability. The Juno satellite has no `raw_rand` exposed via
 * `@junobuild/functions/ic-cdk` today, so combining `time()` (nanoseconds) with the caller's
 * principal + a salt counter gives us enough divergence to avoid collisions in practice; on the
 * (vanishingly rare) collision, we retry with a bumped salt up to {@link CODE_GENERATION_MAX_RETRIES}.
 */
const fnv1a64 = (input: string): bigint => {
	const bytes = new TextEncoder().encode(input);
	let hash = FNV_OFFSET;

	for (const b of bytes) {
		hash = (hash ^ BigInt(b)) & MASK64;
		hash = (hash * FNV_PRIME) & MASK64;
	}

	return hash;
};

const encodeBase32 = (value: bigint): string => {
	let result = '';
	let v = value;

	for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
		result = REFERRAL_CODE_ALPHABET[Number(v % ALPHABET_SIZE)] + result;
		v /= ALPHABET_SIZE;
	}

	return result;
};

const generateReferralCode = ({
	ownerText,
	salt
}: {
	ownerText: PrincipalText;
	salt: number;
}): string => encodeBase32(fnv1a64(`${ownerText}|${time().toString()}|${salt}`));

// ─── Code assignment (idempotent, called from the profile hook) ──────────

const findOwnedCode = ({
	caller,
	ownerText
}: {
	caller: Uint8Array;
	ownerText: PrincipalText;
}): string | undefined => {
	const { items } = listDocsStore({
		collection: Collection.REFERRAL_CODES,
		caller,
		params: {}
	});

	const match = items.find(([_, item]) => {
		try {
			return decodeDocData<ReferralCodeDoc>(item.data).owner === ownerText;
		} catch {
			return false;
		}
	});

	return match?.[0];
};

/**
 * Idempotent: returns the caller's existing code if one is already on record, otherwise
 * generates+writes a fresh code and returns it. Safe to call on every profile create / update —
 * subsequent calls short-circuit after the scan.
 */
export const assignReferralCodeIfMissing = ({
	caller,
	ownerText
}: {
	caller: Uint8Array;
	ownerText: PrincipalText;
}): string | undefined => {
	const existing = findOwnedCode({ caller, ownerText });

	if (nonNullish(existing)) {
		return existing;
	}

	for (let salt = 0; salt < CODE_GENERATION_MAX_RETRIES; salt++) {
		const code = generateReferralCode({ ownerText, salt });

		const conflict = getDocStore({
			collection: Collection.REFERRAL_CODES,
			key: code,
			caller
		});

		if (isNullish(conflict)) {
			try {
				setDocStore({
					collection: Collection.REFERRAL_CODES,
					key: code,
					caller,
					doc: {
						data: encodeDocData<ReferralCodeDoc>({ owner: ownerText })
					}
				});

				logInfo({
					message: 'referral_code_assigned',
					detail: { user: ownerText, code }
				});

				return code;
			} catch (e: unknown) {
				// Another race won the key. Fall through to the next salt.
				const msg = e instanceof Error ? e.message : String(e);
				logInfo({
					message: 'referral_code_retry',
					detail: { user: ownerText, code, salt, error: msg }
				});
			}
		}
	}

	logError({
		message: 'referral_code_exhausted',
		detail: { user: ownerText, attempts: CODE_GENERATION_MAX_RETRIES }
	});
};

/**
 * Profile-hook entry point — runs alongside the VXP onboarding hook. Only fires on the
 * `profiles/{caller}` write (the user creating their own profile); any other key is ignored.
 */
export const onProfileSetForReferralCode = (ctx: OnSetDocContext): void => {
	const {
		caller,
		data: { collection, key }
	} = ctx;

	if (collection !== Collection.PROFILES) {
		return;
	}

	const callerText = Principal.fromUint8Array(caller).toText();

	if (key !== callerText) {
		return;
	}

	try {
		assignReferralCodeIfMissing({ caller, ownerText: callerText });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		// Best effort — never fail the profile write because of a referral-code issue.
		logError({
			message: 'referral_code_assign_failed',
			detail: { user: callerText, error: msg }
		});
	}
};

// ─── Query handlers ──────────────────────────────────────────────────────

export const getMyReferralCodeFn = (): { code: string | undefined } => {
	const caller = msgCaller();
	const code = findOwnedCode({
		caller: caller.toUint8Array(),
		ownerText: caller.toText()
	});

	return { code };
};

export const lookupReferralCodeFn = ({
	code
}: {
	code: string;
}): { owner: PrincipalText | undefined } => {
	const caller = msgCaller();
	const normalized = code.trim().toUpperCase();

	if (!REFERRAL_CODE_REGEX.test(normalized)) {
		return { owner: undefined };
	}

	const doc = getDocStore({
		collection: Collection.REFERRAL_CODES,
		key: normalized,
		caller: caller.toUint8Array()
	});

	if (isNullish(doc)) {
		return { owner: undefined };
	}

	try {
		return { owner: decodeDocData<ReferralCodeDoc>(doc.data).owner };
	} catch {
		return { owner: undefined };
	}
};

/**
 * Lists every redemption where the caller is the referrer — used by the FE to show "Friends you
 * referred" plus a counter of how many are over the cap. Sorted newest-first by `redeemedAtMs`.
 *
 * The doc key (the referee principal) is folded into each row as `referee`, since the FE needs
 * it to render names/avatars and the wire schema doesn't otherwise surface keys.
 */
export const listMyReferralsFn = (): ReferralListItem[] => {
	const caller = msgCaller();
	const callerText = caller.toText();

	const { items } = listDocsStore({
		collection: Collection.REFERRALS,
		caller: caller.toUint8Array(),
		params: {}
	});

	const referrals: ReferralListItem[] = [];

	for (const [key, item] of items) {
		try {
			const doc = decodeDocData<ReferralDoc>(item.data);

			if (doc.referrer === callerText) {
				referrals.push({ ...doc, referee: key });
			}
		} catch {
			// Skip malformed rows — they should never have passed the assertion in the first place.
		}
	}

	return referrals.sort((a, b) => b.redeemedAtMs - a.redeemedAtMs);
};

// ─── Update handler (redeem) ─────────────────────────────────────────────

const initialOwedPayout = (): VxpMilestoneState => ({
	status: 'owed',
	amountBaseUnits: REFERRAL_VXP_BONUS_BASE_UNITS.toString()
});

const initialUnpaidPayout = (): VxpMilestoneState => ({
	status: 'none',
	amountBaseUnits: REFERRAL_VXP_BONUS_BASE_UNITS.toString()
});

/**
 * Idempotently writes a confirmed bilateral friendship between two principals. Used by the
 * referral flow to auto-friend referrer and referee on redemption (and by
 * {@link claimReferralFriendshipFn} for the existing-user friendship-only path).
 *
 * No-op if a friendship already exists in any state — never downgrades an existing relation.
 */
const writeConfirmedFriendship = ({
	caller,
	sender,
	target
}: {
	caller: Uint8Array;
	sender: PrincipalText;
	target: PrincipalText;
}): void => {
	const relationId = [sender, target].sort().join('#');

	const existing = getDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		caller
	});

	if (nonNullish(existing)) {
		// Already friends / pending / blocked — never overwrite. The whole point of the
		// referral-friendship is to bootstrap a new connection; if one already exists, leave it.
		return;
	}

	const relation: Relation = {
		category: RelationCategory.FRIEND,
		state: RelationState.ACTIVE,
		participants: [sender, target]
	};

	setDocStore({
		collection: Collection.RELATIONS,
		key: relationId,
		caller,
		doc: {
			data: encodeDocData(relation)
		}
	});
};

export const redeemReferralCodeFn = ({ code }: { code: string }): void => {
	const caller = msgCaller();
	const callerBytes = caller.toUint8Array();
	const callerText = caller.toText();
	const normalized = code.trim().toUpperCase();

	if (!REFERRAL_CODE_REGEX.test(normalized)) {
		throw new Error('Invalid referral code format.');
	}

	const existingRedemption = getDocStore({
		collection: Collection.REFERRALS,
		key: callerText,
		caller: callerBytes
	});

	if (nonNullish(existingRedemption)) {
		throw new Error('You have already redeemed a referral code.');
	}

	const profileDoc = getDocStore({
		collection: Collection.PROFILES,
		key: callerText,
		caller: callerBytes
	});

	if (isNullish(profileDoc)) {
		throw new Error('Create your profile before redeeming a referral code.');
	}

	// Signup-window gate — only fresh sign-ups earn the VXP bonus. Existing users who use a
	// referral link land in {@link claimReferralFriendshipFn} instead (friendship only, no VXP).
	// `created_at` is the Juno-managed nanosecond timestamp on the profile doc.
	const nowMs = Number(time() / 1_000_000n);
	const profileCreatedAtMs = nonNullish(profileDoc.created_at)
		? Number(profileDoc.created_at / 1_000_000n)
		: 0;

	if (nowMs - profileCreatedAtMs > REFERRAL_SIGNUP_WINDOW_MS) {
		throw new Error(REFERRAL_EXISTING_USER_REASON);
	}

	const codeDoc = getDocStore({
		collection: Collection.REFERRAL_CODES,
		key: normalized,
		caller: callerBytes
	});

	if (isNullish(codeDoc)) {
		throw new Error('Unknown referral code.');
	}

	const { owner: referrer } = decodeDocData<ReferralCodeDoc>(codeDoc.data);

	if (referrer === callerText) {
		throw new Error('You cannot redeem your own referral code.');
	}

	const doc: ReferralDoc = {
		version: 1,
		referrer,
		code: normalized,
		redeemedAtMs: Number(time() / 1_000_000n),
		// `withinReferrerCap` and `referrerPayout` are decided in the hook so the cap counter
		// reads the freshest state. The referee bonus is owed unconditionally.
		withinReferrerCap: false,
		refereePayout: initialOwedPayout(),
		referrerPayout: initialUnpaidPayout()
	};

	setDocStore({
		collection: Collection.REFERRALS,
		key: callerText,
		caller: callerBytes,
		doc: {
			data: encodeDocData<ReferralDoc>(doc)
		}
	});

	// Bilateral auto-confirmed friendship — both parties already consented (one shared an invite
	// link, the other clicked it). No request/accept dance needed.
	writeConfirmedFriendship({
		caller: callerBytes,
		sender: referrer,
		target: callerText
	});

	logInfo({
		message: 'referral_redeemed',
		detail: { referee: callerText, referrer, code: normalized }
	});
};

/**
 * Friendship-only path for users who use a referral link but aren't eligible for the VXP bonus
 * (account older than {@link REFERRAL_SIGNUP_WINDOW_MS}, or already redeemed). Looks up the code,
 * refuses self-referral, and writes a bilateral confirmed friendship between caller and referrer.
 *
 * Idempotent: returns silently if a relation already exists in any state.
 */
export const claimReferralFriendshipFn = ({ code }: { code: string }): void => {
	const caller = msgCaller();
	const callerBytes = caller.toUint8Array();
	const callerText = caller.toText();
	const normalized = code.trim().toUpperCase();

	if (!REFERRAL_CODE_REGEX.test(normalized)) {
		throw new Error('Invalid referral code format.');
	}

	const codeDoc = getDocStore({
		collection: Collection.REFERRAL_CODES,
		key: normalized,
		caller: callerBytes
	});

	if (isNullish(codeDoc)) {
		throw new Error('Unknown referral code.');
	}

	const { owner: referrer } = decodeDocData<ReferralCodeDoc>(codeDoc.data);

	if (referrer === callerText) {
		throw new Error('You cannot use your own referral link.');
	}

	writeConfirmedFriendship({
		caller: callerBytes,
		sender: referrer,
		target: callerText
	});

	logInfo({
		message: 'referral_friendship_claimed',
		detail: { caller: callerText, referrer, code: normalized }
	});
};

// ─── Assertions (write-time guards) ──────────────────────────────────────

export const assertSetReferralCode = ({
	caller,
	data: {
		collection,
		key,
		data: { current, proposed }
	}
}: AssertSetDocContext): void => {
	if (collection !== Collection.REFERRAL_CODES) {
		return;
	}

	if (nonNullish(current)) {
		throw new Error('Referral codes are write-once.');
	}

	if (!REFERRAL_CODE_REGEX.test(key)) {
		throw new Error('Invalid referral code format.');
	}

	const callerText = Principal.fromUint8Array(caller).toText();
	const { owner } = decodeDocData<ReferralCodeDoc>(proposed.data);

	if (owner !== callerText) {
		throw new Error('Referral code owner must match the caller.');
	}

	const existing = findOwnedCode({ caller, ownerText: callerText });

	if (nonNullish(existing) && existing !== key) {
		throw new Error('You already have a referral code.');
	}
};

export const assertSetReferral = ({
	caller,
	data: {
		collection,
		key,
		data: { current, proposed }
	}
}: AssertSetDocContext): void => {
	if (collection !== Collection.REFERRALS) {
		return;
	}

	const callerText = Principal.fromUint8Array(caller).toText();
	const proposedDoc = decodeDocData<ReferralDoc>(proposed.data);

	// Updates are allowed only when the writer is the satellite itself replaying its own hook
	// (i.e. the caller is the referee whose redemption is being processed). The shape of allowed
	// updates is constrained: only payout state may evolve; referrer / code / redeemedAtMs are
	// immutable.
	if (nonNullish(current)) {
		if (key !== callerText) {
			throw new Error('Only the referee may update their referral record.');
		}

		const currentDoc = decodeDocData<ReferralDoc>(current.data);

		if (
			currentDoc.referrer !== proposedDoc.referrer ||
			currentDoc.code !== proposedDoc.code ||
			currentDoc.redeemedAtMs !== proposedDoc.redeemedAtMs
		) {
			throw new Error('Referral record core fields are immutable.');
		}

		return;
	}

	if (key !== callerText) {
		throw new Error('Referral key must match the caller (referee) principal.');
	}

	if (proposedDoc.referrer === callerText) {
		throw new Error('Self-referrals are not allowed.');
	}

	try {
		Principal.fromText(proposedDoc.referrer);
	} catch {
		throw new Error('Invalid referrer principal.');
	}

	if (!REFERRAL_CODE_REGEX.test(proposedDoc.code)) {
		throw new Error('Invalid referral code format.');
	}

	const codeDoc = getDocStore({
		collection: Collection.REFERRAL_CODES,
		key: proposedDoc.code,
		caller
	});

	if (isNullish(codeDoc)) {
		throw new Error('Unknown referral code.');
	}

	const { owner } = decodeDocData<ReferralCodeDoc>(codeDoc.data);

	if (owner !== proposedDoc.referrer) {
		throw new Error('Referrer does not match the referral code owner.');
	}
};

// ─── Payout hook ─────────────────────────────────────────────────────────

const transferErrorText = (err: TransferError): string => {
	if ('InsufficientFunds' in err) {
		return `InsufficientFunds(balance=${err.InsufficientFunds.balance})`;
	}

	if ('BadFee' in err) {
		return `BadFee(expected_fee=${err.BadFee.expected_fee})`;
	}

	return JSON.stringify(err, jsonReplacer);
};

const transferReferralBonus = async ({
	ledger,
	toOwner,
	memoLabel
}: {
	ledger: IcrcLedgerCanister;
	toOwner: Principal;
	memoLabel: string;
}): Promise<{ ok: true; blockIndex: bigint } | { ok: false; error: string }> => {
	const to: Account = { owner: toOwner };
	const memoBytes = new TextEncoder().encode(`vxp:referral:${memoLabel}`);

	const tryTransfer = (fee?: bigint) =>
		ledger.icrc1Transfer({
			args: {
				to,
				amount: REFERRAL_VXP_BONUS_BASE_UNITS,
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
 * Counts how many redemptions already credited the given referrer — used to enforce
 * {@link REFERRAL_MAX_PAID} (lifetime) and {@link VXP_REFERRAL_MONTHLY_CAP} (per calendar month).
 *
 * Returns two parallel tallies so the hook can enforce *both* caps in a single doc scan: the
 * lifetime cap (every doc whose `referrerPayout` is not `none`) and the current-month cap (same
 * filter, plus `redeemedAtMs` within the UTC calendar month that contains `referenceMs`). Anything
 * in flight (`owed` / `processing` / `paid`) counts toward both caps so racing redemptions can't
 * slip past either by being mid-transfer.
 *
 * Both totals exclude the row being processed (`excludeKey`).
 */
const countReferrerCredits = ({
	caller,
	referrer,
	excludeKey,
	referenceMs
}: {
	caller: Uint8Array;
	referrer: PrincipalText;
	excludeKey: string;
	referenceMs: number;
}): { lifetime: number; currentMonth: number } => {
	const { items } = listDocsStore({
		collection: Collection.REFERRALS,
		caller,
		params: {}
	});

	const monthStartMs = currentMonthStartUtcMs(referenceMs);

	return items.reduce<{ lifetime: number; currentMonth: number }>(
		(acc, [key, item]) => {
			if (key === excludeKey) {
				return acc;
			}

			try {
				const doc = decodeDocData<ReferralDoc>(item.data);

				if (doc.referrer === referrer && doc.referrerPayout.status !== 'none') {
					const inMonth = doc.redeemedAtMs >= monthStartMs;

					return {
						lifetime: acc.lifetime + 1,
						currentMonth: acc.currentMonth + (inMonth ? 1 : 0)
					};
				}
			} catch {
				// Ignore malformed rows for accounting purposes.
			}

			return acc;
		},
		{ lifetime: ZERO_COUNT, currentMonth: ZERO_COUNT }
	);
};

/**
 * UTC-anchored start of the calendar month containing `referenceMs`. We anchor on UTC instead of
 * the satellite's local time so the cap reset boundary is deterministic and identical for every
 * caller — no "did the cap reset for me?" race based on which canister replied.
 */
const currentMonthStartUtcMs = (referenceMs: number): number => {
	const d = new Date(referenceMs);

	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};

const ZERO_COUNT = 0;

const persistReferral = ({
	caller,
	refereeKey,
	doc,
	version
}: {
	caller: Uint8Array;
	refereeKey: string;
	doc: ReferralDoc;
	version?: bigint;
}): void => {
	setDocStore({
		caller,
		collection: Collection.REFERRALS,
		key: refereeKey,
		doc: {
			data: encodeDocData<ReferralDoc>(doc),
			...(nonNullish(version) ? { version } : {})
		}
	});
};

const PERSIST_MAX_RETRIES = 3;

/**
 * Drives one side's payout to completion (or records the error). The flow mirrors
 * `payOutMilestoneIfNeeded` in [`vxp-onboarding.services.ts`](./vxp-onboarding.services.ts):
 * lock the row by writing `processing` first, transfer, then retry the persist with a fresh read
 * so a concurrent doc update doesn't leave us "transferred but not recorded".
 */
const driveSidePayout = async ({
	ledger,
	caller,
	refereeKey,
	side,
	recipient,
	memoLabel
}: {
	ledger: IcrcLedgerCanister;
	caller: Uint8Array;
	refereeKey: string;
	side: 'referee' | 'referrer';
	recipient: PrincipalText;
	memoLabel: string;
}): Promise<void> => {
	const snapshot = getDocStore({
		collection: Collection.REFERRALS,
		key: refereeKey,
		caller
	});

	if (isNullish(snapshot)) {
		return;
	}

	const snapshotDoc = decodeDocData<ReferralDoc>(snapshot.data);
	const sideKey = side === 'referee' ? 'refereePayout' : 'referrerPayout';
	const currentStatus = snapshotDoc[sideKey].status;

	if (currentStatus !== 'owed') {
		return;
	}

	try {
		persistReferral({
			caller,
			refereeKey,
			doc: {
				...snapshotDoc,
				[sideKey]: { ...snapshotDoc[sideKey], status: 'processing' }
			},
			version: snapshot.version
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logInfo({
			message: 'referral_payout_locked',
			detail: { referee: refereeKey, side, error: msg }
		});

		return;
	}

	const result = await transferReferralBonus({
		ledger,
		toOwner: Principal.fromText(recipient),
		memoLabel
	});

	if (result.ok) {
		logInfo({
			message: 'referral_payout_ok',
			detail: {
				referee: refereeKey,
				side,
				recipient,
				amount: REFERRAL_VXP_BONUS_BASE_UNITS,
				block_index: result.blockIndex,
				memo: memoLabel
			}
		});
	} else {
		logError({
			message: 'referral_payout_err',
			detail: {
				referee: refereeKey,
				side,
				recipient,
				amount: REFERRAL_VXP_BONUS_BASE_UNITS,
				memo: memoLabel,
				error: result.error
			}
		});
	}

	const attemptPersist = async (attempt: number): Promise<void> => {
		if (attempt >= PERSIST_MAX_RETRIES) {
			return;
		}

		const latest = getDocStore({
			collection: Collection.REFERRALS,
			key: refereeKey,
			caller
		});

		if (isNullish(latest)) {
			return;
		}

		const latestDoc = decodeDocData<ReferralDoc>(latest.data);
		const curState = latestDoc[sideKey];

		if (curState.status !== 'owed' && curState.status !== 'processing') {
			return;
		}

		const updated: VxpMilestoneState = result.ok
			? {
					status: 'paid',
					amountBaseUnits: REFERRAL_VXP_BONUS_BASE_UNITS.toString(),
					blockIndex: result.blockIndex.toString()
				}
			: {
					...curState,
					status: 'owed',
					lastError: result.error
				};

		try {
			persistReferral({
				caller,
				refereeKey,
				doc: { ...latestDoc, [sideKey]: updated },
				version: latest.version
			});
		} catch (e: unknown) {
			if (attempt === PERSIST_MAX_RETRIES - 1) {
				const msg = e instanceof Error ? e.message : String(e);
				logError({
					message: 'referral_persist_failed',
					detail: {
						referee: refereeKey,
						side,
						transfer_ok: result.ok,
						error: msg
					}
				});
				throw new Error(
					`Failed to persist referral ${side} payout (referee=${refereeKey}, ok=${result.ok})`
				);
			}

			await attemptPersist(attempt + 1);
		}
	};

	await attemptPersist(0);
};

/**
 * Decides referrer cap on first run and arms the `referrerPayout` if within cap. Idempotent:
 * - First fire: referrerPayout is `none`; we count credits, write `owed` (or leave `none` if over
 *   the cap), then re-enter to drive the payout.
 * - Re-fire: referrerPayout is already `owed` / `processing` / `paid`; we skip the arming step.
 */
const armReferrerPayoutIfFirstFire = ({
	caller,
	refereeKey
}: {
	caller: Uint8Array;
	refereeKey: string;
}): void => {
	const snapshot = getDocStore({
		collection: Collection.REFERRALS,
		key: refereeKey,
		caller
	});

	if (isNullish(snapshot)) {
		return;
	}

	const snapshotDoc = decodeDocData<ReferralDoc>(snapshot.data);

	if (snapshotDoc.referrerPayout.status !== 'none') {
		return;
	}

	const { lifetime: lifetimeCount, currentMonth: monthlyCount } = countReferrerCredits({
		caller,
		referrer: snapshotDoc.referrer,
		excludeKey: refereeKey,
		referenceMs: snapshotDoc.redeemedAtMs
	});

	const withinLifetimeCap = lifetimeCount < REFERRAL_MAX_PAID;
	const withinMonthlyCap = monthlyCount < VXP_REFERRAL_MONTHLY_CAP;
	const withinCap = withinLifetimeCap && withinMonthlyCap;

	if (!withinCap) {
		logInfo({
			message: 'referral_over_cap',
			detail: {
				referrer: snapshotDoc.referrer,
				referee: refereeKey,
				lifetime_count: lifetimeCount,
				monthly_count: monthlyCount,
				lifetime_cap: REFERRAL_MAX_PAID,
				monthly_cap: VXP_REFERRAL_MONTHLY_CAP,
				cap_hit: withinLifetimeCap ? 'monthly' : withinMonthlyCap ? 'lifetime' : 'both'
			}
		});

		try {
			persistReferral({
				caller,
				refereeKey,
				doc: { ...snapshotDoc, withinReferrerCap: false },
				version: snapshot.version
			});
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			logInfo({
				message: 'referral_cap_persist_locked',
				detail: { referee: refereeKey, error: msg }
			});
		}

		return;
	}

	try {
		persistReferral({
			caller,
			refereeKey,
			doc: {
				...snapshotDoc,
				withinReferrerCap: true,
				referrerPayout: initialOwedPayout()
			},
			version: snapshot.version
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logInfo({
			message: 'referral_arm_locked',
			detail: { referee: refereeKey, error: msg }
		});
	}
};

export const onReferralSetForVxpPayout = async (ctx: OnSetDocContext): Promise<void> => {
	const {
		caller,
		data: {
			collection,
			key,
			data: { after }
		}
	} = ctx;

	if (collection !== Collection.REFERRALS) {
		return;
	}

	try {
		// Fast-exit on the post-payout self-write: both sides have settled, nothing to do.
		const doc = decodeDocData<ReferralDoc>(after.data);
		const refereeSettled =
			doc.refereePayout.status === 'paid' || doc.refereePayout.status === 'processing';
		const referrerSettled =
			doc.referrerPayout.status === 'paid' ||
			doc.referrerPayout.status === 'processing' ||
			(doc.referrerPayout.status === 'none' && doc.withinReferrerCap === false);

		if (refereeSettled && referrerSettled) {
			return;
		}

		armReferrerPayoutIfFirstFire({ caller, refereeKey: key });

		const ledger = new IcrcLedgerCanister({
			canisterId: Principal.fromText(VXP_LEDGER_CANISTER_ID)
		});

		await driveSidePayout({
			ledger,
			caller,
			refereeKey: key,
			side: 'referee',
			recipient: key,
			memoLabel: 'referee'
		});

		await driveSidePayout({
			ledger,
			caller,
			refereeKey: key,
			side: 'referrer',
			recipient: doc.referrer,
			memoLabel: 'referrer'
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logError({
			message: 'hook_error',
			detail: { hook: 'referral', referee: key, error: msg }
		});
		throw e;
	}
};
