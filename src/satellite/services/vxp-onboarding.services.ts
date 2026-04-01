import { ZERO } from '$lib/constants/app.constants';
import { VXP_LEDGER_CANISTER_ID } from '$lib/constants/canisters.constants';
import { Collection } from '$lib/constants/collections.constants';
import {
	newUserVxpAmountMilestone1BaseUnits,
	newUserVxpAmountMilestone2BaseUnits,
	newUserVxpAmountMilestone3BaseUnits
} from '$lib/constants/vxp-onboarding.constants';
import { ActivityType, type Activity } from '$lib/types/social';
import type {
	VxpMilestoneState,
	VxpNewUserMilestoneKey,
	VxpOnboardingDoc
} from '$lib/types/vxp-onboarding';
import { logError, logInfo } from '$satellite/utils/logger.utils';
import { isNullish, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import type { OnSetDocContext } from '@junobuild/functions';
import { IcrcLedgerCanister, type IcrcLedgerDid } from '@junobuild/functions/canisters/ledger/icrc';
import {
	decodeDocData,
	encodeDocData,
	getDocStore,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';

const MILESTONE_KEYS: VxpNewUserMilestoneKey[] = ['m1', 'm2', 'm3'];

const TRADE_KEY_SUFFIX = `#${ActivityType.TRADE}`;

const LIST_PAGE_SIZE = 500n;

const emptyMilestones = (): VxpOnboardingDoc['milestones'] => ({
	m1: { status: 'none', amountBaseUnits: '0' },
	m2: { status: 'none', amountBaseUnits: '0' },
	m3: { status: 'none', amountBaseUnits: '0' }
});

const amountForMilestone = (key: VxpNewUserMilestoneKey): bigint => {
	switch (key) {
		case 'm1':
			return newUserVxpAmountMilestone1BaseUnits();
		case 'm2':
			return newUserVxpAmountMilestone2BaseUnits();
		case 'm3':
			return newUserVxpAmountMilestone3BaseUnits();

		default: {
			const _: never = key;

			return _;
		}
	}
};

const transferErrorText = (err: IcrcLedgerDid.TransferError): string => {
	if ('InsufficientFunds' in err) {
		return `InsufficientFunds(balance=${err.InsufficientFunds.balance})`;
	}

	if ('BadFee' in err) {
		return `BadFee(expected_fee=${err.BadFee.expected_fee})`;
	}

	return JSON.stringify(err);
};

const payoutMilestone = async ({
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
	const to: IcrcLedgerDid.Account = {
		owner: toOwner,
		subaccount: []
	};

	const memoBytes = new TextEncoder().encode(`vxp:new-user:${memoLabel}`);

	let fee: [] | [bigint] = [];
	let transfer = await ledger.icrc1Transfer({
		args: {
			to,
			amount,
			fee,
			memo: [memoBytes],
			from_subaccount: [],
			created_at_time: []
		}
	});

	if ('Err' in transfer) {
		const err = transfer.Err;

		if ('BadFee' in err) {
			fee = [err.BadFee.expected_fee];
			transfer = await ledger.icrc1Transfer({
				args: {
					to,
					amount,
					fee,
					memo: [memoBytes],
					from_subaccount: [],
					created_at_time: []
				}
			});
		}
	}

	if ('Ok' in transfer) {
		return { ok: true, blockIndex: transfer.Ok };
	}

	return { ok: false, error: transferErrorText(transfer.Err) };
};

const persistOnboarding = ({
	caller,
	key,
	doc,
	version
}: {
	caller: Uint8Array;
	key: string;
	doc: VxpOnboardingDoc;
	version?: bigint;
}): void => {
	logInfo({
		message: 'vxp_onboarding_write',
		detail: {
			collection: Collection.VXP_ONBOARDING,
			key,
			trade_count: doc.tradeCount,
			milestones: MILESTONE_KEYS.map((mk) => `${mk}:${doc.milestones[mk].status}`).join('|'),
			legacy_onboarding_synced: doc.legacyOnboardingSynced === true,
			doc_version: nonNullish(version) ? version.toString() : 'create'
		}
	});

	setDocStore({
		caller,
		collection: Collection.VXP_ONBOARDING,
		key,
		doc: {
			data: encodeDocData(doc),
			...(nonNullish(version) ? { version } : {})
		}
	});
};

/** Count `activities` rows owned by `caller` whose key ends with `#trade` (see `logActivity`). */
const countUserTradeActivities = (caller: Uint8Array): number => {
	let total = 0;
	let startAfter: string | undefined;

	while (true) {
		const page = listDocsStore({
			collection: Collection.ACTIVITIES,
			caller,
			params: {
				owner: caller,
				paginate: {
					limit: LIST_PAGE_SIZE,
					...(nonNullish(startAfter) ? { start_after: startAfter } : {})
				},
				order: { field: 'keys', desc: false }
			}
		});

		if (page.items.length === 0) {
			break;
		}

		for (const [key] of page.items) {
			if (key.endsWith(TRADE_KEY_SUFFIX)) {
				total += 1;
			}
		}

		if (BigInt(page.items.length) < LIST_PAGE_SIZE) {
			break;
		}

		const lastKey = page.items[page.items.length - 1]?.[0];

		if (isNullish(lastKey) || lastKey === startAfter) {
			break;
		}

		startAfter = lastKey;
	}

	return total;
};

const countUserTradeActivitiesSafe = (caller: Uint8Array): number => {
	try {
		return countUserTradeActivities(caller);
	} catch {
		return 0;
	}
};

/**
 * One-time backfill: users who registered or traded before this feature shipped
 * still get m1/m2/m3 based on existing `profiles` + `activities`.
 *
 * When `minimumTradeCount` is set (trade activity hook), the just-written trade always counts
 * even if `listDocsStore` lags or `owner` filtering returns stale/empty on some replicas.
 */
const reconcileLegacyOnboardingState = ({
	caller,
	userKey,
	base,
	version,
	minimumTradeCount
}: {
	caller: Uint8Array;
	userKey: string;
	base: VxpOnboardingDoc;
	version?: bigint;
	minimumTradeCount?: number;
}): void => {
	const historicalTrades = countUserTradeActivitiesSafe(caller);
	const profileDoc = getDocStore({
		collection: Collection.PROFILES,
		key: userKey,
		caller
	});
	const hasProfile = nonNullish(profileDoc);

	const tradeCount = Math.max(base.tradeCount, historicalTrades, minimumTradeCount ?? 0);

	let milestones = { ...base.milestones };

	const oweIfEligible = ({
		mk,
		eligible
	}: {
		mk: VxpNewUserMilestoneKey;
		eligible: boolean;
	}): void => {
		if (milestones[mk].status !== 'none' || !eligible) {
			return;
		}

		milestones = {
			...milestones,
			[mk]: {
				status: 'owed',
				amountBaseUnits: amountForMilestone(mk).toString()
			}
		};
	};

	oweIfEligible({ mk: 'm1', eligible: hasProfile });
	oweIfEligible({ mk: 'm2', eligible: tradeCount >= 1 });
	oweIfEligible({ mk: 'm3', eligible: tradeCount >= 5 });

	const doc: VxpOnboardingDoc = {
		...base,
		tradeCount,
		milestones,
		legacyOnboardingSynced: true
	};

	persistOnboarding({ caller, key: userKey, doc, version });
};

/**
 * If the user traded before `profiles` existed in Juno, legacy sync can set `legacyOnboardingSynced`
 * with m1 still `none`. Any later profile write fixes m1.
 */
const ensureRegistrationMilestoneIfEligible = ({
	caller,
	userKey
}: {
	caller: Uint8Array;
	userKey: string;
}): void => {
	const profileDoc = getDocStore({
		collection: Collection.PROFILES,
		key: userKey,
		caller
	});

	if (isNullish(profileDoc)) {
		return;
	}

	const existing = getDocStore({
		collection: Collection.VXP_ONBOARDING,
		key: userKey,
		caller
	});

	if (isNullish(existing)) {
		return;
	}

	const doc = decodeDocData<VxpOnboardingDoc>(existing.data);

	if (doc.milestones.m1.status !== 'none') {
		return;
	}

	const milestones = {
		...doc.milestones,
		m1: {
			status: 'owed' as const,
			amountBaseUnits: amountForMilestone('m1').toString()
		}
	};

	persistOnboarding({
		caller,
		key: userKey,
		doc: { ...doc, milestones },
		version: existing.version
	});
};

const PERSIST_MAX_RETRIES = 3;

/**
 * Determines the transfer needed for a single milestone:
 * - `owed` → transfer the current expected amount (ignores stale owed values from old constants).
 * - `paid` but below current expected → top-up the difference.
 * - otherwise → nothing to do.
 */
const milestoneTransferNeeded = ({
	ms,
	mk
}: {
	ms: VxpMilestoneState;
	mk: VxpNewUserMilestoneKey;
}): { transferAmount: bigint; memoLabel: string } | undefined => {
	const expectedAmount = amountForMilestone(mk);

	if (ms.status === 'owed') {
		return { transferAmount: expectedAmount, memoLabel: mk };
	}

	if (ms.status === 'paid') {
		const paidSoFar = BigInt(ms.amountBaseUnits);

		if (paidSoFar < expectedAmount) {
			return { transferAmount: expectedAmount - paidSoFar, memoLabel: `${mk}:topup` };
		}
	}

	return undefined;
};

const payOutMilestoneIfNeeded = async ({
	ledger,
	caller,
	userKey,
	mk
}: {
	ledger: IcrcLedgerCanister;
	caller: Uint8Array;
	userKey: string;
	mk: VxpNewUserMilestoneKey;
}): Promise<void> => {
	const snapshot = getDocStore({
		collection: Collection.VXP_ONBOARDING,
		key: userKey,
		caller
	});

	if (isNullish(snapshot)) {
		return;
	}

	const snapshotDoc = decodeDocData<VxpOnboardingDoc>(snapshot.data);
	const needed = milestoneTransferNeeded({ ms: snapshotDoc.milestones[mk], mk });

	if (isNullish(needed) || needed.transferAmount <= ZERO) {
		return;
	}

	const expectedAmount = amountForMilestone(mk);

	try {
		persistOnboarding({
			caller,
			key: userKey,
			doc: {
				...snapshotDoc,
				milestones: {
					...snapshotDoc.milestones,
					[mk]: {
						...snapshotDoc.milestones[mk],
						status: 'processing'
					}
				}
			},
			version: snapshot.version
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);

		logInfo({
			message: 'payout_locked',
			detail: {
				user: userKey,
				milestone: mk,
				error: msg
			}
		});

		return;
	}

	const result = await payoutMilestone({
		ledger,
		toOwner: Principal.fromText(userKey),
		amount: needed.transferAmount,
		memoLabel: needed.memoLabel
	});

	if (result.ok) {
		logInfo({
			message: 'payout_ok',
			detail: {
				user: userKey,
				milestone: mk,
				amount: needed.transferAmount,
				block_index: result.blockIndex,
				memo: needed.memoLabel
			}
		});
	} else {
		logError({
			message: 'payout_err',
			detail: {
				user: userKey,
				milestone: mk,
				amount: needed.transferAmount,
				memo: needed.memoLabel,
				error: result.error
			}
		});
	}

	for (let attempt = 0; attempt < PERSIST_MAX_RETRIES; attempt++) {
		const latest = getDocStore({
			collection: Collection.VXP_ONBOARDING,
			key: userKey,
			caller
		});

		if (isNullish(latest)) {
			break;
		}

		const latestDoc = decodeDocData<VxpOnboardingDoc>(latest.data);
		const curMs = latestDoc.milestones[mk];

		const needsUpdate =
			curMs.status === 'owed' ||
			curMs.status === 'processing' ||
			(curMs.status === 'paid' && BigInt(curMs.amountBaseUnits) < expectedAmount);

		if (!needsUpdate) {
			break;
		}

		const updatedMilestone: VxpMilestoneState = result.ok
			? {
					status: 'paid',
					amountBaseUnits: expectedAmount.toString(),
					blockIndex: result.blockIndex.toString()
				}
			: {
					...curMs,
					status: curMs.status === 'processing' ? 'owed' : curMs.status,
					lastError: result.error
				};

		try {
			persistOnboarding({
				caller,
				key: userKey,
				doc: {
					...latestDoc,
					milestones: {
						...latestDoc.milestones,
						[mk]: updatedMilestone
					}
				},
				version: latest.version
			});
			break;
		} catch (e: unknown) {
			if (attempt === PERSIST_MAX_RETRIES - 1) {
				const msg = e instanceof Error ? e.message : String(e);
				logError({
					message: 'persist_failed',
					detail: {
						user: userKey,
						milestone: mk,
						transfer_ok: result.ok,
						error: msg
					}
				});
				throw new Error(
					`Failed to persist ${mk} after transfer (user=${userKey}, ok=${result.ok})`
				);
			}
		}
	}
};

/**
 * Try to transfer every milestone that is `owed` or `paid` below the current expected
 * amount (order m1 → m3). After each transfer the persist is retried with a fresh read
 * so a concurrent doc write does not leave a "transferred but not recorded" state.
 */
const payOutOwedMilestones = async ({
	caller,
	userKey
}: {
	caller: Uint8Array;
	userKey: string;
}): Promise<void> => {
	const ledger = new IcrcLedgerCanister({
		canisterId: Principal.fromText(VXP_LEDGER_CANISTER_ID)
	});

	for (const mk of MILESTONE_KEYS) {
		await payOutMilestoneIfNeeded({ ledger, caller, userKey, mk });
	}
};

/** 10% at registration; runs on profile create and updates so legacy users are covered. */
export const onProfileSetForVxpOnboarding = async (ctx: OnSetDocContext): Promise<void> => {
	const {
		caller,
		data: {
			collection,
			key,
			data: { before: _before }
		}
	} = ctx;

	try {
		if (collection !== Collection.PROFILES) {
			return;
		}

		const callerText = Principal.fromUint8Array(caller).toText();

		if (key !== callerText) {
			return;
		}

		const userKey = key;

		const existing = getDocStore({
			collection: Collection.VXP_ONBOARDING,
			key: userKey,
			caller
		});

		const prev: VxpOnboardingDoc | undefined = nonNullish(existing)
			? decodeDocData<VxpOnboardingDoc>(existing.data)
			: undefined;

		const base: VxpOnboardingDoc = prev ?? {
			version: 1,
			tradeCount: 0,
			milestones: emptyMilestones()
		};

		if (base.legacyOnboardingSynced !== true) {
			reconcileLegacyOnboardingState({
				caller,
				userKey,
				base,
				version: existing?.version
			});
		} else {
			ensureRegistrationMilestoneIfEligible({ caller, userKey });
		}

		await payOutOwedMilestones({ caller, userKey });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		const user =
			collection === Collection.PROFILES ? key : Principal.fromUint8Array(caller).toText();
		logError({ message: 'hook_error', detail: { hook: 'profile', user, error: msg } });
		throw e;
	}
};

/** 40% after first bet; 50% after five bets; retries any `owed` payouts. */
export const onTradeActivityForVxpOnboarding = async (ctx: OnSetDocContext): Promise<void> => {
	const {
		caller,
		data: {
			collection,
			data: { before, after }
		}
	} = ctx;

	let userKeyForLog = Principal.fromUint8Array(caller).toText();

	try {
		if (collection !== Collection.ACTIVITIES) {
			return;
		}

		if (nonNullish(before)) {
			return;
		}

		const activity = decodeDocData<Activity>(after.data);

		if (activity.type !== ActivityType.TRADE) {
			return;
		}

		let activityUserPrincipal: Principal;

		try {
			activityUserPrincipal = Principal.fromText(activity.user);
		} catch {
			return;
		}

		if (activityUserPrincipal.compareTo(Principal.fromUint8Array(caller)) !== 'eq') {
			return;
		}

		const userKey = activity.user;
		userKeyForLog = userKey;

		const existing = getDocStore({
			collection: Collection.VXP_ONBOARDING,
			key: userKey,
			caller
		});

		const prev: VxpOnboardingDoc | undefined = nonNullish(existing)
			? decodeDocData<VxpOnboardingDoc>(existing.data)
			: undefined;

		const base: VxpOnboardingDoc = prev ?? {
			version: 1,
			tradeCount: 0,
			milestones: emptyMilestones()
		};

		if (base.legacyOnboardingSynced !== true) {
			reconcileLegacyOnboardingState({
				caller,
				userKey,
				base,
				version: existing?.version,
				minimumTradeCount: base.tradeCount + 1
			});
			await payOutOwedMilestones({ caller, userKey });

			return;
		}

		const tradeCount = base.tradeCount + 1;

		let milestones: VxpOnboardingDoc['milestones'] = { ...base.milestones };

		if (tradeCount === 1 && milestones.m2.status === 'none') {
			milestones = {
				...milestones,
				m2: {
					status: 'owed',
					amountBaseUnits: amountForMilestone('m2').toString()
				}
			};
		}

		if (tradeCount === 5 && milestones.m3.status === 'none') {
			milestones = {
				...milestones,
				m3: {
					status: 'owed',
					amountBaseUnits: amountForMilestone('m3').toString()
				}
			};
		}

		persistOnboarding({
			caller,
			key: userKey,
			doc: {
				...base,
				tradeCount,
				milestones,
				legacyOnboardingSynced: true
			},
			version: existing?.version
		});

		await payOutOwedMilestones({ caller, userKey });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logError({ message: 'hook_error', detail: { hook: 'trade', user: userKeyForLog, error: msg } });
		throw e;
	}
};
