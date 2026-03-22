import { VXP_LEDGER_CANISTER_ID_DEFAULT } from '$lib/constants/canisters.constants';
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
	setDocStore({
		caller,
		collection: Collection.VXP_ONBOARDING,
		key,
		doc: {
			data: encodeDocData(doc),
			...(version !== undefined ? { version } : {})
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
					...(startAfter !== undefined ? { start_after: startAfter } : {})
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
		if (lastKey === undefined || lastKey === startAfter) {
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
	const hasProfile = profileDoc !== undefined;

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

	if (profileDoc === undefined) {
		return;
	}

	const existing = getDocStore({
		collection: Collection.VXP_ONBOARDING,
		key: userKey,
		caller
	});

	if (existing === undefined) {
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

/** Try to transfer every milestone currently marked `owed` (order m1 → m3). */
const payOutOwedMilestones = async ({
	caller,
	userKey
}: {
	caller: Uint8Array;
	userKey: string;
}): Promise<void> => {
	const ledger = new IcrcLedgerCanister({
		canisterId: Principal.fromText(VXP_LEDGER_CANISTER_ID_DEFAULT)
	});

	for (const mk of MILESTONE_KEYS) {
		const snapshot = getDocStore({
			collection: Collection.VXP_ONBOARDING,
			key: userKey,
			caller
		});

		if (snapshot !== undefined) {
			const snapshotDoc = decodeDocData<VxpOnboardingDoc>(snapshot.data);
			const ms = snapshotDoc.milestones[mk];

			if (ms.status === 'owed') {
				const amount = BigInt(ms.amountBaseUnits);
				const result = await payoutMilestone({
					ledger,
					toOwner: Principal.fromText(userKey),
					amount,
					memoLabel: mk
				});

				const latest = getDocStore({
					collection: Collection.VXP_ONBOARDING,
					key: userKey,
					caller
				});

				if (latest !== undefined) {
					const latestDoc = decodeDocData<VxpOnboardingDoc>(latest.data);
					const curMs = latestDoc.milestones[mk];

					if (curMs.status === 'owed') {
						if (result.ok) {
							const paid: VxpMilestoneState = {
								status: 'paid',
								amountBaseUnits: curMs.amountBaseUnits,
								blockIndex: result.blockIndex.toString()
							};
							persistOnboarding({
								caller,
								key: userKey,
								doc: {
									...latestDoc,
									milestones: {
										...latestDoc.milestones,
										[mk]: paid
									}
								},
								version: latest.version
							});
						} else {
							persistOnboarding({
								caller,
								key: userKey,
								doc: {
									...latestDoc,
									milestones: {
										...latestDoc.milestones,
										[mk]: {
											...curMs,
											lastError: result.error
										}
									}
								},
								version: latest.version
							});
						}
					}
				}
			}
		}
	}
};

/** 10% at registration; runs on profile create and updates so legacy users are covered. */
export const onProfileSetForVxpOnboarding = async ({
	caller,
	data: {
		collection,
		key,
		data: { before: _before }
	}
}: OnSetDocContext): Promise<void> => {
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

	const prev: VxpOnboardingDoc | undefined = existing
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
};

/** 40% after first bet; 50% after five bets; retries any `owed` payouts. */
export const onTradeActivityForVxpOnboarding = async ({
	caller,
	data: {
		collection,
		data: { before, after }
	}
}: OnSetDocContext): Promise<void> => {
	if (collection !== Collection.ACTIVITIES) {
		return;
	}

	if (before !== undefined) {
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

	const existing = getDocStore({
		collection: Collection.VXP_ONBOARDING,
		key: userKey,
		caller
	});

	const prev: VxpOnboardingDoc | undefined = existing
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
};
