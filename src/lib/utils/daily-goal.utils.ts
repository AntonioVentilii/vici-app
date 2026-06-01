import { todayKey } from '$lib/utils/streak.utils';

// Standard daily target — predictions a user commits to make in a day.
// Single source of truth for both the Flow session ceiling and the
// dashboard "Today's goal" resume card, so the two surfaces never drift.
export const DAILY_GOAL_TARGET = 10;

export interface DailyGoalState {
	// Predictions committed toward the goal on `date` (`0..target`).
	done: number;
	// Local-day key (`YYYY-MM-DD`) the count belongs to.
	date: string;
}

/**
 * Effective goal count for *today*. Returns the stored `done` only when
 * it belongs to the current local day; any earlier day has already
 * elapsed, so the goal reads as 0. Pure — callers decide when to read.
 *
 * Used for hydration/display so a session opened on a new day shows a
 * fresh goal before the first prediction lands.
 */
export const rolloverDailyGoal = ({
	done,
	date,
	now = new Date()
}: {
	done: number;
	date?: string;
	now?: Date;
}): number => (date === todayKey(now) ? Math.max(0, done) : 0);

/**
 * Record one prediction toward the daily goal. Rolls the count over to
 * the current local day first (so the previous day's total never leaks
 * into today), then increments by one, capped at `target`. Stateless —
 * callers persist the returned `{ done, date }`.
 */
export const applyDailyGoalBump = ({
	done,
	date,
	target,
	now = new Date()
}: {
	done: number;
	date?: string;
	target: number;
	now?: Date;
}): DailyGoalState => {
	const today = todayKey(now);
	const base = rolloverDailyGoal({ done, date, now });

	return { done: Math.min(target, base + 1), date: today };
};
