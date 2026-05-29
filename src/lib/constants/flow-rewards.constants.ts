// Flow Mode reward ladder.
//
// Two ladders run in parallel: the swipe-count milestones below (this
// file) and streak / accuracy events (handled separately by the
// streak engine). Rarity grows exponentially — first swipes feel like
// fireworks, later rewards are rare and feel earned.

import type { MessageKey } from '$lib/utils/i18n.utils';

/**
 * Base XP awarded on every committed prediction (YES / NO). Skips
 * do not award XP. Multiplied by the streak combo multiplier.
 */
export const BASE_XP_PER_PREDICTION = 10;

export type FlowMilestoneId =
	| 'first-call'
	| 'swipe-3'
	| 'swipe-5'
	| 'swipe-10'
	| 'swipe-25'
	| 'swipe-50'
	| 'swipe-100'
	| 'swipe-250'
	| 'swipe-500'
	| 'swipe-1000';

export interface FlowMilestone {
	id: FlowMilestoneId;
	swipeCount: number;
	bonusXp: number;
	// Paired copy — terse, second-person, no narration. Surfaces in the
	// XP pop and (later) the Companion bubble. `null` = silent beat
	// (character pop only, no copy line).
	copyKey: MessageKey | null;
}

/**
 * Swipe-count milestones. Hit when the *committed* swipe count
 * (`betsCount`) reaches `swipeCount` exactly — 1 / 3 / 5 / 10 / 25 /
 * 50 / 100 / 250 / 500 / 1000.
 */
export const FLOW_MILESTONES: readonly FlowMilestone[] = [
	{ id: 'first-call', swipeCount: 1, bonusXp: 50, copyKey: 'flow.milestone.first_call' },
	{ id: 'swipe-3', swipeCount: 3, bonusXp: 0, copyKey: 'flow.milestone.three_deep' },
	{ id: 'swipe-5', swipeCount: 5, bonusXp: 0, copyKey: 'flow.milestone.halfway_to_ten' },
	{ id: 'swipe-10', swipeCount: 10, bonusXp: 100, copyKey: 'flow.milestone.ten_deep' },
	{ id: 'swipe-25', swipeCount: 25, bonusXp: 0, copyKey: null },
	{ id: 'swipe-50', swipeCount: 50, bonusXp: 250, copyKey: 'flow.milestone.fifty_in' },
	{ id: 'swipe-100', swipeCount: 100, bonusXp: 500, copyKey: 'flow.milestone.one_hundred' },
	{ id: 'swipe-250', swipeCount: 250, bonusXp: 1000, copyKey: 'flow.milestone.two_fifty' },
	{ id: 'swipe-500', swipeCount: 500, bonusXp: 2000, copyKey: 'flow.milestone.five_hundred' },
	{ id: 'swipe-1000', swipeCount: 1000, bonusXp: 5000, copyKey: 'flow.milestone.one_thousand' }
] as const;

/**
 * Lifetime-call threshold below which accuracy is *not* surfaced in
 * the UI. Below the gate, calls + streak are the visible stats; the
 * accuracy percentage unlocks once the sample is large enough to be
 * meaningful.
 *
 * Applies to anywhere user-facing accuracy would otherwise show
 * (Flow end summary, Profile dashboard, leaderboard preview cards).
 */
export const ACCURACY_GATE_CALLS = 30;

/**
 * `true` when the user has logged enough lifetime calls to make
 * percentage-accuracy a useful — and not noisy — signal.
 */
export const isAccuracyUnlocked = (totalCalls: number): boolean =>
	totalCalls >= ACCURACY_GATE_CALLS;
