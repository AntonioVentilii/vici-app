// Named haptic patterns — single source of truth for VICI's
// touch-feedback vocabulary. Per `vici design team/testAV1.html` §02
// (every motion moment has a paired haptic) and the system-wide
// Self-check ("Light tap / soft tick / double pulse / triple tap /
// mischief / soft hum / firm tap / low thud — eight distinct
// patterns documented").
//
// Call sites use the named pattern, not raw ms numbers. That keeps
// the spec → code mapping inspectable and avoids drift when a
// pattern needs to be retuned globally.

export type HapticPattern =
	| 'light-tap'
	| 'soft-tick'
	| 'double-pulse'
	| 'triple-tap'
	| 'mischief'
	| 'soft-hum'
	| 'firm-tap'
	| 'low-thud'
	| 'celebration';

type HapticValue = number | readonly number[];

/**
 * Pattern definitions. Numbers are the same ms values you'd pass to
 * `navigator.vibrate` (single number = single buzz; array = pulse
 * sequence with alternating buzz / silence).
 */
const HAPTIC_PATTERNS: Record<HapticPattern, HapticValue> = {
	// Background / ambient feedback. Very brief.
	'light-tap': 8,
	// Negative-state — skip, soft pass-through. Lighter than commit.
	'soft-tick': [4, 8],
	// Standard YES / NO commit on a routine swipe. Single firm beat.
	'firm-tap': 12,
	// Milestone double — bonus XP at swipe 10 / 50 / 250 / 1000.
	'double-pulse': [12, 40],
	// First call + streak tier-up — strongest reusable pattern.
	'triple-tap': [12, 40, 18],
	// Trickster's signature — staccato, mischievous.
	mischief: [6, 20, 6, 20, 6],
	// Idle / Companion arrival — longer, smoother. Reads as ambient.
	'soft-hum': [40],
	// Streak break — single low buzz, honest, no warmth.
	'low-thud': 28,
	// Session complete celebration. Distinct envelope; not in the
	// canonical 8 (those are within-session beats) but carved out so
	// it lives in the same vocabulary.
	celebration: [14, 30, 20, 30, 40]
};

/**
 * Best-effort haptic. Safe to call from server-rendered or
 * iOS-Safari contexts (where `navigator.vibrate` doesn't exist) —
 * silently no-ops and never throws.
 *
 * Use the named pattern, not raw ms — see file header for why.
 */
export const haptic = (pattern: HapticPattern): void => {
	if (typeof navigator === 'undefined' || !('vibrate' in navigator)) {
		return;
	}

	try {
		navigator.vibrate(HAPTIC_PATTERNS[pattern] as number | number[]);
	} catch {
		// Vibration API can throw on hostile UA shims (e.g. some
		// in-app browsers). The feedback is non-essential — swallow.
	}
};
