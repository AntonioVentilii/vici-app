// Flow Mode reward constants.
//
// The accuracy-surfacing gate. A committed swipe mints NO VXP — the
// economy is deflation-safe (see `docs/ai/frontend/design.md` §7.3): VXP
// is minted only at the overtime finish (+25) and rare lifetime-volume
// milestones, both owned by the motion engine.

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
