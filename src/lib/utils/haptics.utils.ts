import { preferencesStore } from '$lib/stores/preferences.store';
import { get } from 'svelte/store';

// Named haptic patterns — single source of truth for VICI's
// touch-feedback vocabulary. Every motion moment has a paired
// haptic; the eight named patterns below are the full set.
//
// Call sites use the named pattern, not raw ms numbers — that
// keeps the vocabulary inspectable and avoids drift when a pattern
// needs to be retuned globally.
//
// Per the Web Vibration API: array entries alternate vibrate / pause
// (odd indexes are gaps, even indexes are buzzes). A pattern with N
// buzzes therefore has N + (N - 1) entries — never an even count
// ending in a pause.

export type HapticPattern =
	| 'light-tap'
	| 'soft-tick'
	| 'double-pulse'
	| 'triple-tap'
	| 'mischief'
	| 'soft-hum'
	| 'firm-tap'
	| 'low-thud'
	| 'celebration'
	| 'milestone-tap'
	| 'oracle-tap'
	| 'oracle-roll'
	| 'centurion'
	| 'vici-fanfare'
	| 'streak-ramp';

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
	// vibrate 12 ms, pause 40 ms, vibrate 12 ms. Two beats.
	'double-pulse': [12, 40, 12],
	// First call + streak tier-up — strongest reusable pattern.
	// vibrate 12 / pause 40 / vibrate 18 / pause 40 / vibrate 14.
	// Three beats with a slight crescendo on the middle.
	'triple-tap': [12, 40, 18, 40, 14],
	// Trickster's signature — staccato, mischievous.
	mischief: [6, 20, 6, 20, 6],
	// Idle / Companion arrival — longer, smoother. Reads as ambient.
	'soft-hum': [40],
	// Streak break — single low buzz, honest, no warmth.
	'low-thud': 28,
	// Session complete celebration — distinct envelope from the
	// within-session beats. Lives in the same vocabulary so call
	// sites stay consistent.
	celebration: [14, 30, 20, 30, 40],
	// Mid-tier milestone beat — used at 10 / 250 / 500 swipes + streak
	// tier-up. Matches the prototype motion-engine `[25, 30, 25]`.
	'milestone-tap': [25, 30, 25],
	// Oracle's first-leaderboard arrival — `[40, 60, 40]`.
	'oracle-tap': [40, 60, 40],
	// Oracle's 50-swipe roll — `[25, 30, 25, 40, 60]`.
	'oracle-roll': [25, 30, 25, 40, 60],
	// Centurion (100 swipes) — `[12, 30, 12, 30, 12, 30, 60]`.
	centurion: [12, 30, 12, 30, 12, 30, 60],
	// Vici 1000 fanfare — `[40, 30, 40, 30, 80]`.
	'vici-fanfare': [40, 30, 40, 30, 80],
	// Streak ramp-up beat (multi-stage flame escalation) —
	// `[40, 60, 40, 60, 80]`.
	'streak-ramp': [40, 60, 40, 60, 80]
};

/**
 * Best-effort haptic. Safe to call from server-rendered or
 * iOS-Safari contexts (where `navigator.vibrate` doesn't exist) —
 * silently no-ops and never throws.
 *
 * Use the named pattern, not raw ms — see file header for why.
 */
export const haptic = (pattern: HapticPattern): void => {
	if (!get(preferencesStore).hapticsEnabled) {
		return;
	}

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
