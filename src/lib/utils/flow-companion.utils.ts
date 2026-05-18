// Companion beats — priority resolver for Flow Mode.
//
// Per `vici design team/testAV1.html` §06 Self-check:
//   "Priority order resolves conflicts cleanly. Resolution >
//    Threshold > Streak tier-up > First-time > Swipe-count >
//    Every-10th ambient. Highest wins; lower defers to the next
//    eligible swipe."
//
// On any single committed swipe, multiple beats can be eligible
// (e.g. swipe-count milestone + streak tier-up). Calling
// `showCompanion` for each would clobber the bubble and break
// "scarcity protects meaning" (testAV1 §00). This module picks one.

import type { FlameStage } from '$lib/utils/streak.utils';

export type CompanionBeatKind =
	| 'resolution'
	| 'threshold'
	| 'streak-tier'
	| 'first-time'
	| 'swipe-count'
	| 'ambient'
	| 'low-consensus';

export interface CompanionBeat {
	kind: CompanionBeatKind;
	// Routed `who` — drives which character renders in the bubble.
	// Per spec defended-territory rules (testAV1 §00 + brand
	// README §07): VICI = protagonist + ambient; Flame = streak
	// only; Oracle = truth / threshold / resolution; Trickster =
	// contrarian wins (low-consensus).
	who: 'vici' | 'oracle' | 'trickster' | 'flame';
	// Single-line copy. Brand voice — terse, second-person,
	// imperative or declarative, no narration, no emoji.
	line: string;
	// Optional Flame stage (only used when `who === 'flame'`).
	stage?: FlameStage;
	// Optional dwell override (defaults to Companion's 3.2 s).
	dwell_ms?: number;
}

/**
 * Numeric priorities — higher wins. Mirrors the spec's order
 * exactly; do not retune without re-reading testAV1 §06.
 */
const PRIORITY: Record<CompanionBeatKind, number> = {
	resolution: 60,
	threshold: 50,
	'streak-tier': 40,
	'first-time': 30,
	'swipe-count': 20,
	'low-consensus': 15,
	ambient: 10
};

/**
 * Pick the highest-priority beat from a candidate list. Returns
 * `null` when the list is empty. Stable on ties (first-listed
 * wins) to preserve call-site ordering.
 */
export const pickHighestPriorityBeat = (beats: readonly CompanionBeat[]): CompanionBeat | null => {
	if (beats.length === 0) {
		return null;
	}

	let [top] = beats;

	for (const b of beats.slice(1)) {
		if (PRIORITY[b.kind] > PRIORITY[top.kind]) {
			top = b;
		}
	}

	return top;
};
