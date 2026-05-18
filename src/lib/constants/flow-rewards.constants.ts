// Flow Mode reward ladder — derived from the canonical motion spec
// (`vici design team/testAV1.html`, "Reward ladder map" + "Self-check").
//
// Two ladders run in parallel: the swipe-count milestones below (this
// file) and streak / accuracy events (handled separately by the
// streak engine). Rarity grows exponentially — first swipes feel like
// fireworks, later rewards are rare and feel earned.

/**
 * Base XP awarded on every committed swipe (YES / NO). Skips do not
 * award XP. Multiplied by the streak combo multiplier.
 */
export const BASE_XP_PER_BET = 10;

export type FlowMilestoneId = 'first-call' | 'swipe-10' | 'swipe-50' | 'swipe-250' | 'swipe-1000';

export interface FlowMilestone {
	id: FlowMilestoneId;
	swipeCount: number;
	bonusXp: number;
	// Paired copy — terse, second-person, no narration. Surfaces in the
	// XP pop and (later) the Companion bubble.
	copy: string;
}

/**
 * Swipe-count milestones. Hit when the *committed* swipe count
 * (`betsCount`) reaches `swipeCount` exactly. Rarity stretches:
 * 1 → 10 → 50 → 250 → 1000 (exponential spacing on a log axis).
 */
export const FLOW_MILESTONES: readonly FlowMilestone[] = [
	{ id: 'first-call', swipeCount: 1, bonusXp: 50, copy: 'First call.' },
	{ id: 'swipe-10', swipeCount: 10, bonusXp: 100, copy: 'Ten deep.' },
	{ id: 'swipe-50', swipeCount: 50, bonusXp: 250, copy: 'Fifty in.' },
	{ id: 'swipe-250', swipeCount: 250, bonusXp: 500, copy: 'Two-fifty.' },
	{ id: 'swipe-1000', swipeCount: 1000, bonusXp: 1000, copy: 'One thousand.' }
] as const;

/**
 * Lookup the milestone (if any) hit by an exact swipe count. Returns
 * `null` if `swipeCount` doesn't match a milestone threshold.
 */
export const findFlowMilestone = (swipeCount: number): FlowMilestone | null =>
	FLOW_MILESTONES.find((m) => m.swipeCount === swipeCount) ?? null;

/**
 * Lifetime-call threshold below which accuracy is *not* surfaced in
 * the UI. Per testAV1 §03 reward map / Self-check:
 *   "Accuracy display is gated by call volume. Hidden until 30
 *    lifetime calls. Until then, calls + streak are the visible stats."
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
