export type FlameStage = 'spark' | 'ember' | 'flame' | 'blaze' | 'inferno';

/**
 * Maps streak day-count to one of the five Flame stages.
 * Thresholds per design system: SPARK 1-2d, EMBER 3-6d, FLAME 7-14d, BLAZE 15-29d, INFERNO 30+d.
 */
export const stageForStreak = (days: number): FlameStage => {
	if (days >= 30) {
		return 'inferno';
	}

	if (days >= 15) {
		return 'blaze';
	}

	if (days >= 7) {
		return 'flame';
	}

	if (days >= 3) {
		return 'ember';
	}

	return 'spark';
};

export const FLAME_STAGE_LABELS: Record<FlameStage, string> = {
	spark: 'SPARK',
	ember: 'EMBER',
	flame: 'FLAME',
	blaze: 'BLAZE',
	inferno: 'INFERNO'
};
