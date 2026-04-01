/**
 * Milestone keys: `m1` = 10% at registration; `m2` = 40% after first bet; `m3` = 50% after five bets.
 */
export type VxpNewUserMilestoneKey = 'm1' | 'm2' | 'm3';

export type VxpMilestonePayoutStatus = 'none' | 'owed' | 'processing' | 'paid';

export interface VxpMilestoneState {
	status: VxpMilestonePayoutStatus;
	/** Amount owed or paid, in ICRC base units (smallest indivisible). */
	amountBaseUnits: string;
	/** Set when status is `paid`. */
	blockIndex?: string;
	/** Last ledger error when status is `owed` (retry on next trade). */
	lastError?: string;
}

/**
 * Per-user new-user VXP ladder (Juno `vxp_onboarding` collection).
 * `tradeCount` counts qualifying trade activities processed by the satellite hook (not registration).
 */
export interface VxpOnboardingDoc {
	version: 1;
	tradeCount: number;
	milestones: Record<VxpNewUserMilestoneKey, VxpMilestoneState>;
	/**
	 * After the first full scan of `profiles` + `activities`, we only increment `tradeCount`
	 * on new trades (avoids recounting on every request).
	 */
	legacyOnboardingSynced?: boolean;
}
