// Flow motion engine — lifetime swipe state + hard-pause beat resolver.
// Priority: accuracy threshold → streak tier-up → first-time → milestone → ambient.
// See `docs/ai/frontend/design.md` §7.

import { FLOW_MILESTONES } from '$lib/constants/flow-rewards.constants';
import { FLAME_STAGE_LABELS, stageForStreak, type FlameStage } from '$lib/utils/streak.utils';

const STORAGE_KEY = 'vici.motion.state.v1';

const TIER_RANK: Record<FlameStage, number> = {
	spark: 1,
	ember: 2,
	flame: 3,
	blaze: 4,
	inferno: 5
};

export type MotionCharacter = 'vici' | 'oracle' | 'trickster' | 'flame';

export interface MotionBeatPayload {
	kind: string;
	character: MotionCharacter;
	copy: string | null;
	duration_ms: number;
	hardPause: boolean;
	bonusXp: number;
	badge?: string;
	flameStage?: FlameStage;
}

export interface MotionSwipeInput {
	side: 'YES' | 'NO' | 'SKIP';
	correct?: boolean;
	isContrarian?: boolean;
	dailyStreak: number;
}

export interface MotionSwipeResult {
	baseXp: number;
	bonusXp: number;
	xpGained: number;
	beat: MotionBeatPayload | null;
}

interface MotionLifetime {
	calls: number;
	yes: number;
	no: number;
	skips: number;
	wins: number;
}

interface MotionFlags {
	firstYes: boolean;
	firstNo: boolean;
	firstContrarian: boolean;
	accThreshold60: boolean;
	accThreshold70: boolean;
	accThreshold80: boolean;
}

interface MotionState {
	lifetime: MotionLifetime;
	flags: MotionFlags;
	streakTier: FlameStage;
}

const defaultState = (): MotionState => ({
	lifetime: { calls: 0, yes: 0, no: 0, skips: 0, wins: 0 },
	flags: {
		firstYes: false,
		firstNo: false,
		firstContrarian: false,
		accThreshold60: false,
		accThreshold70: false,
		accThreshold80: false
	},
	streakTier: 'spark'
});

const loadState = (): MotionState => {
	if (typeof localStorage === 'undefined') {
		return defaultState();
	}

	try {
		const raw = localStorage.getItem(STORAGE_KEY);

		if (!raw) {
			return defaultState();
		}

		const parsed = JSON.parse(raw) as Partial<MotionState>;
		const base = defaultState();
		const streakTier =
			typeof parsed.streakTier === 'string' && parsed.streakTier in TIER_RANK
				? parsed.streakTier
				: base.streakTier;

		return {
			...base,
			...parsed,
			lifetime: { ...base.lifetime, ...parsed.lifetime },
			flags: { ...base.flags, ...parsed.flags },
			streakTier
		};
	} catch {
		return defaultState();
	}
};

const saveState = (state: MotionState): void => {
	if (typeof localStorage === 'undefined') {
		return;
	}

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Best-effort persistence only.
	}
};

const titleCaseStage = (stage: FlameStage): string => FLAME_STAGE_LABELS[stage];

const milestoneBeat = (swipeCount: number): MotionBeatPayload | null => {
	const milestone = FLOW_MILESTONES.find((m) => m.swipeCount === swipeCount);

	if (!milestone) {
		return null;
	}

	const character: MotionCharacter = milestone.swipeCount >= 50 ? 'oracle' : 'vici';

	return {
		kind: `milestone-${swipeCount}`,
		character,
		copy: milestone.copy,
		duration_ms: swipeCount === 1 ? 1300 : swipeCount >= 50 ? 1500 : 1200,
		hardPause: true,
		bonusXp: milestone.bonusXp,
		badge: swipeCount === 1000 ? 'One thousand' : undefined
	};
};

/**
 * Records a committed swipe and returns XP + an optional hard-pause beat.
 * Caller must delay deck advance while `beat?.hardPause` is true.
 */
export const recordMotionSwipe = (input: MotionSwipeInput): MotionSwipeResult => {
	const { side, correct = false, isContrarian = false, dailyStreak } = input;
	const state = loadState();
	const baseXp = side === 'SKIP' ? 0 : 10;
	let bonusXp = 0;
	let beat: MotionBeatPayload | null = null;

	if (side === 'SKIP') {
		state.lifetime.skips += 1;
	} else {
		state.lifetime.calls += 1;

		if (side === 'YES') {
			state.lifetime.yes += 1;
		} else {
			state.lifetime.no += 1;
		}

		if (correct) {
			state.lifetime.wins += 1;
		}
	}

	const { calls } = state.lifetime;
	const accuracy = calls > 0 ? state.lifetime.wins / calls : 0;

	// 1 — Accuracy threshold (Oracle), once per band.
	if (!beat && calls >= 10) {
		const thresholds = [
			{ pct: 0.8, flag: 'accThreshold80' as const, label: '20' },
			{ pct: 0.7, flag: 'accThreshold70' as const, label: '30' },
			{ pct: 0.6, flag: 'accThreshold60' as const, label: '40' }
		];

		for (let i = 0; i < thresholds.length; i++) {
			const threshold = thresholds[i];

			if (accuracy >= threshold.pct && !state.flags[threshold.flag]) {
				state.flags[threshold.flag] = true;

				for (let j = i + 1; j < thresholds.length; j++) {
					state.flags[thresholds[j].flag] = true;
				}

				bonusXp = 250;
				beat = {
					kind: 'acc-threshold',
					character: 'oracle',
					copy: `Top ${threshold.label}% accuracy.`,
					duration_ms: 1500,
					hardPause: true,
					bonusXp
				};
				break;
			}
		}
	}

	// 2 — Daily streak tier-up (Flame). SPARK is silent on swipe #1.
	const previousTier = state.streakTier;
	const nextTier = stageForStreak(dailyStreak);

	if (!beat && TIER_RANK[nextTier] > TIER_RANK[previousTier] && nextTier !== 'spark') {
		state.streakTier = nextTier;
		beat = {
			kind: 'streak-tier-up',
			character: 'flame',
			copy: `${titleCaseStage(nextTier)}.`,
			duration_ms: 800,
			hardPause: true,
			bonusXp: 0,
			flameStage: nextTier
		};
	} else {
		state.streakTier = nextTier;
	}

	// 3 — First-time events (deferred on call #1 so milestone wins).
	if (!beat && calls > 1) {
		if (side === 'YES' && !state.flags.firstYes) {
			state.flags.firstYes = true;
			beat = {
				kind: 'first-yes',
				character: 'vici',
				copy: 'Locked in.',
				duration_ms: 900,
				hardPause: true,
				bonusXp: 0
			};
		} else if (side === 'NO' && !state.flags.firstNo) {
			state.flags.firstNo = true;
			beat = {
				kind: 'first-no',
				character: 'vici',
				copy: 'Filed.',
				duration_ms: 900,
				hardPause: true,
				bonusXp: 0
			};
		} else if (isContrarian && correct && !state.flags.firstContrarian) {
			state.flags.firstContrarian = true;
			beat = {
				kind: 'first-contrarian',
				character: 'trickster',
				copy: 'Against the grain.',
				duration_ms: 1100,
				hardPause: true,
				bonusXp: 0
			};
		}
	}

	// 4 — Swipe-count milestones (shared ladder with flow-rewards.constants).
	if (!beat && side !== 'SKIP') {
		const milestone = milestoneBeat(calls);

		if (milestone) {
			({ bonusXp } = milestone);
			beat = milestone;
		}
	}

	// 5 — Ambient every 10th call (no hard pause).
	if (!beat && side !== 'SKIP' && calls > 10 && calls % 10 === 0) {
		beat = {
			kind: 'ambient-10',
			character: 'vici',
			copy: null,
			duration_ms: 360,
			hardPause: false,
			bonusXp: 0
		};
	}

	saveState(state);

	return {
		baseXp,
		bonusXp,
		xpGained: baseXp + bonusXp,
		beat
	};
};

export const resetMotionEngineState = (): void => {
	saveState(defaultState());
};
