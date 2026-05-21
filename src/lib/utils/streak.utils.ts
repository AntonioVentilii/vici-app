import type { MessageKey } from '$lib/utils/i18n.utils';

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

export const FLAME_STAGE_LABEL_KEYS: Record<FlameStage, MessageKey> = {
	spark: 'flame.spark',
	ember: 'flame.ember',
	flame: 'flame.flame',
	blaze: 'flame.blaze',
	inferno: 'flame.inferno'
};

/**
 * Local-day key in `YYYY-MM-DD` form (user's local timezone). Used as
 * the persistence anchor for the daily-streak engine.
 */
export const todayKey = (now: Date = new Date()): string => {
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');

	return `${y}-${m}-${d}`;
};

/**
 * Day delta between two `YYYY-MM-DD` keys (`to - from`). Returns
 * `Infinity` if either key is malformed. Used to decide whether the
 * previous recorded day was "yesterday" (continue), "today" (no-op),
 * or "earlier" (break).
 */
export const dayDelta = ({ from, to }: { from: string; to: string }): number => {
	const parse = (k: string): number | null => {
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);

		if (!m) {
			return null;
		}

		const [, y, mo, d] = m;
		const ts = Date.UTC(Number(y), Number(mo) - 1, Number(d));

		return Number.isFinite(ts) ? ts : null;
	};

	const a = parse(from);
	const b = parse(to);

	if (a === null || b === null) {
		return Infinity;
	}

	return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

export interface DailyStreakBump {
	// New streak day count after the bump (`>= 1`).
	streak: number;
	// `'continue'` — same day or +1 day from the recorded key (or
	// no record at all → start at SPARK 1).
	// `'break'`    — gap >= 2 days; previous streak ended, fresh
	// start at SPARK 1 with the break choreography.
	transition: 'continue' | 'break';
	// `true` only on the first swipe of a new local day (the count
	// actually moved). `false` for additional swipes on the same day.
	bumped: boolean;
	// New value to persist as the user's `lastActiveDay`.
	lastActiveDay: string;
}

/**
 * Compute the next daily-streak state from the persisted streak +
 * lastActiveDay and a fresh "now". Stateless — callers (FlowMode,
 * profile sync, etc.) decide when to persist the result.
 *
 * Rules: streak progresses on any swipe (YES / NO / SKIP all count);
 * no freezes, no rescues; missed-day = reset to SPARK 1 with the
 * break choreography. Flame never goes dark — it returns to SPARK.
 */
export const applyDailyStreakBump = ({
	streak,
	lastActiveDay,
	now = new Date()
}: {
	streak: number;
	lastActiveDay?: string;
	now?: Date;
}): DailyStreakBump => {
	const today = todayKey(now);

	if (lastActiveDay === undefined || lastActiveDay === '') {
		return { streak: 1, transition: 'continue', bumped: true, lastActiveDay: today };
	}

	const delta = dayDelta({ from: lastActiveDay, to: today });

	if (delta <= 0) {
		// Same day (or — defensively — clock drift to the past). No
		// further bump, but echo the existing streak / day so callers
		// can branch on `bumped`.
		return {
			streak: Math.max(1, streak),
			transition: 'continue',
			bumped: false,
			lastActiveDay
		};
	}

	if (delta === 1) {
		return {
			streak: Math.max(1, streak) + 1,
			transition: 'continue',
			bumped: true,
			lastActiveDay: today
		};
	}

	// `delta >= 2` — at least one day was missed. Streak breaks; the
	// today-swipe restarts the ladder at SPARK 1 (Flame never goes
	// dark — it returns to SPARK).
	return { streak: 1, transition: 'break', bumped: true, lastActiveDay: today };
};
