// Flow Mode reward constants.
//
// Base XP per committed prediction and the accuracy-surfacing gate.
// The swipe-count volume ladder is owned by the motion engine.

/**
 * Base XP awarded on every committed prediction (YES / NO). Skips
 * do not award XP. Multiplied by the streak combo multiplier.
 */
export const BASE_XP_PER_PREDICTION = 10;

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
