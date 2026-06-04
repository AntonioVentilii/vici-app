import { get as storageGet, set as storageSet } from '$lib/utils/storage.utils';
import { todayKey } from '$lib/utils/streak.utils';
import { nonNullish } from '@dfinity/utils';

// Standard daily target — predictions a user commits to making in a day.
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

// localStorage mirror of the daily-goal count. The authoritative copy
// lives on the profile (`persistDailyGoal`), but that write is a
// best-effort async round-trip to the satellite — in a flaky in-app
// browser webview it can silently drop, which would reset the count to
// 0 on re-entry and let a user blow past the daily hard cap (#484). The
// mirror is written synchronously on every commit so the cap survives a
// refresh even when the server write is lost, and is reconciled with the
// profile (max wins) on entry.
const DAILY_GOAL_STORAGE_KEY = 'flowDailyGoal';

const isDailyGoalState = (value: unknown): value is DailyGoalState =>
	nonNullish(value) &&
	typeof (value as DailyGoalState).done === 'number' &&
	typeof (value as DailyGoalState).date === 'string';

/** Read the localStorage mirror, or `undefined` when absent / malformed. */
export const readDailyGoalMirror = (): DailyGoalState | undefined => {
	const raw = storageGet<DailyGoalState>({ key: DAILY_GOAL_STORAGE_KEY });

	return isDailyGoalState(raw) ? raw : undefined;
};

/** Write the localStorage mirror. Best-effort (see `storage.utils`). */
export const writeDailyGoalMirror = (state: DailyGoalState): void => {
	storageSet({ key: DAILY_GOAL_STORAGE_KEY, value: state });
};

/**
 * Effective daily-goal state on Flow entry. Takes the higher of the
 * profile count and the localStorage mirror (both rolled over to today
 * first, so a stale day reads as 0), so a lost server write can't reset
 * the cap. Pure aside from the mirror read.
 */
export const reconcileDailyGoalOnEntry = ({
	done,
	date,
	now = new Date()
}: {
	done: number;
	date?: string;
	now?: Date;
}): { done: number; date: string | undefined } => {
	const mirror = readDailyGoalMirror();
	const profileDone = rolloverDailyGoal({ done, date, now });
	const mirrorDone = nonNullish(mirror)
		? rolloverDailyGoal({ done: mirror.done, date: mirror.date, now })
		: 0;
	const best = Math.max(profileDone, mirrorDone);

	return { done: best, date: best > 0 ? todayKey(now) : date };
};
