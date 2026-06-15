import { del as storageDel, get as storageGet, set as storageSet } from '$lib/utils/storage.utils';
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

// localStorage mirror of the daily-goal count. The AUTHORITATIVE copy
// lives on the profile and is set by the satellite (`recordFlowSwipe`,
// which the server computes and caps — the client never sends a count).
// The mirror is only a fast OFFLINE HINT: written synchronously on every
// commit so the cap still gates a refresh that races the server read or a
// signed-out / offline session, but it can never RAISE the count above the
// authoritative server value (that's what let a cleared client re-open the
// cap before — the leak this fix closes). On entry the server count wins;
// the mirror only fills in when there is no server value yet.
// Namespaced + versioned to match the repo's other persisted keys
// (`vici.motion.state.v3`, `vici-theme`) and leave room for a future
// shape migration.
const DAILY_GOAL_STORAGE_KEY = 'vici.flow.daily-goal.v1';

const isDailyGoalState = (value: unknown): value is DailyGoalState =>
	nonNullish(value) &&
	// Reject NaN / Infinity / negatives: a corrupt or hand-edited
	// count must not propagate through `rolloverDailyGoal` and defeat
	// the `>= DAILY_HARD_CAP` gate.
	Number.isFinite((value as DailyGoalState).done) &&
	(value as DailyGoalState).done >= 0 &&
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

/** Drop the localStorage mirror. See `reconcileIdentityScopedStorage`. */
export const clearDailyGoalMirror = (): void => {
	storageDel({ key: DAILY_GOAL_STORAGE_KEY });
};

/**
 * Effective daily-goal state on Flow entry. The profile count is the
 * AUTHORITATIVE server value (set by `recordFlowSwipe`); the localStorage
 * mirror is only an offline hint. So:
 *
 *  - When a server count is hydrated (`hasProfile`), it WINS outright — the
 *    mirror can never raise it. This is the fix for the honest-reset leak:
 *    a cleared / stale client that re-saved a lower count used to be able to
 *    re-open the cap via a symmetric `max`; now it can't.
 *  - When there is no server value yet (signed out, profile not loaded, or
 *    a failed fetch), the mirror alone gates the session (rolled over to
 *    today, so a stale day reads as 0).
 *
 * The reconciled count is written back to the mirror only when it doesn't
 * already match, so a later entry without a hydrated profile still gates on
 * the freshest known count. Reads and (conditionally) writes the mirror.
 */
export const reconcileDailyGoalOnEntry = ({
	done,
	date,
	hasProfile = false,
	now = new Date()
}: {
	done: number;
	date?: string;
	hasProfile?: boolean;
	now?: Date;
}): { done: number; date: string | undefined } => {
	const mirror = readDailyGoalMirror();
	const profileDone = rolloverDailyGoal({ done, date, now });
	const mirrorDone = nonNullish(mirror)
		? rolloverDailyGoal({ done: mirror.done, date: mirror.date, now })
		: 0;
	// Server value wins when present; otherwise the mirror is the only gate.
	const best = hasProfile ? profileDone : mirrorDone;
	const today = todayKey(now);

	if (best > 0 && best !== mirrorDone) {
		writeDailyGoalMirror({ done: best, date: today });
	}

	return { done: best, date: best > 0 ? today : date };
};
