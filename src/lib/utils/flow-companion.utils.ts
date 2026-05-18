// Companion beats — priority resolver for Flow Mode.
//
// Priority order (highest wins; lower defers to the next eligible
// swipe):
//   Resolution > Threshold > Streak tier-up > First-time >
//   Swipe-count > Low-consensus > Ambient
//
// On any single committed swipe, multiple beats can be eligible
// (e.g. swipe-count milestone + streak tier-up). Firing every one
// would clobber the bubble and break the brand's scarcity rule —
// characters appear at milestones, not as ambient garnish. This
// module picks one.

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
	// Defended-territory rule: VICI owns protagonist + ambient
	// moments; Flame owns streak only; Oracle owns truth /
	// threshold / resolution; Trickster owns contrarian wins
	// (low-consensus). Characters never cross into each other's
	// territory.
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
 * Numeric priorities — higher wins. Do not retune lightly; the
 * order encodes which character is allowed to interrupt which.
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
