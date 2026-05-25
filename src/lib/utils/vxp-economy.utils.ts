import {
	VXP_DEFAULT_STAKE,
	VXP_P_WIN_FLOOR,
	VXP_STAKE_LADDER,
	VXP_STAKE_UNLOCK_AT_CALLS,
	VXP_STREAK_BONUSES,
	type VxpStake
} from '$lib/constants/vxp-economy.constants';

/**
 * Compute the *net* VXP a user would gain on a winning call.
 *
 * Formula (prototype `docs/economy.md` §1):
 *
 *   payout_on_win = stake / max(P_WIN_FLOOR, p_win)
 *   net_win       = payout_on_win − stake
 *
 * The floor on `p_win` caps long-shot payouts at ~20× stake; without it
 * a 1% side would pay 100× and deplete the economy.
 *
 * Returns at least 1 (a winning call always nets *something*, even if
 * the math floors to zero with extreme stakes and near-certain odds).
 */
export const vxpNetWin = ({
	stake,
	pWin
}: {
	/** User's stake on the call, in VXP. */
	stake: number;
	/** Consensus probability of the user's chosen side at commit time, 0–1. */
	pWin: number;
}): number => {
	const safeP = Math.max(VXP_P_WIN_FLOOR, pWin);
	const gross = Math.round(stake / safeP);

	return Math.max(1, gross - stake);
};

/**
 * What the user forfeits on a losing call — always exactly `−stake`.
 * Surfaced as a helper so call sites don't have to remember whether to
 * negate at the formatting layer.
 */
export const vxpLoss = ({ stake }: { stake: number }): number => -Math.abs(stake);

/**
 * Whether the stake slider should be exposed to the user. Below the
 * unlock threshold, `VXP_DEFAULT_STAKE` is the only option shown — no
 * decision paralysis on first calls.
 */
export const vxpStakeSliderUnlocked = ({ calls }: { calls: number }): boolean =>
	calls >= VXP_STAKE_UNLOCK_AT_CALLS;

/**
 * Snap an arbitrary numeric stake to the nearest valid ladder rung. Used
 * defensively when consuming server / persisted stake values that may
 * have been written before a ladder change.
 */
export const snapToStakeLadder = ({ value }: { value: number }): VxpStake => {
	if (!Number.isFinite(value)) {
		return VXP_DEFAULT_STAKE;
	}

	const [first] = VXP_STAKE_LADDER;
	let best: VxpStake = first;
	let bestDist = Math.abs(value - best);

	for (const stake of VXP_STAKE_LADDER) {
		const dist = Math.abs(value - stake);

		if (dist < bestDist) {
			best = stake;
			bestDist = dist;
		}
	}

	return best;
};

/**
 * Streak milestone the user is on track to hit next. Returns `null` once
 * the user is past the highest milestone (`30`). Used by Flow's coach
 * copy ("3 to go for the +150 bonus").
 */
export const nextStreakMilestone = ({
	streak
}: {
	streak: number;
}): { milestone: number; bonus: number; daysToGo: number } | null => {
	const milestones = Object.keys(VXP_STREAK_BONUSES)
		.map((k) => Number(k))
		.sort((a, b) => a - b);

	for (const milestone of milestones) {
		if (streak < milestone) {
			return {
				milestone,
				bonus: VXP_STREAK_BONUSES[milestone],
				daysToGo: milestone - streak
			};
		}
	}

	return null;
};
