import { browser } from '$app/environment';
import { isNullish, nonNullish } from '@dfinity/utils';
import { writable } from 'svelte/store';

/**
 * Client-only guest session. A visitor who takes the "preview first, sign up
 * later" path out of onboarding becomes a guest: they can predict in Flow with
 * no account, no balance, and no wall, and their picks are a throwaway,
 * in-session preview that powers the conversion nudges only.
 *
 * Everything here is preview state, persisted to `localStorage` so a reload
 * keeps the funnel coherent and never written to the satellite (a session with
 * no principal has no doc). It is **cleared on conversion and on a real
 * sign-out** — preview picks are discarded, never turned into positions, and
 * the converted member starts with an empty portfolio.
 *
 * `sessionPickCount` is session-scoped on purpose (it mirrors the count, not a
 * lifetime call total) so a returning guest never re-fires the first-pick
 * celebration. It is the source for the soft/remind/inline cadence.
 */
export interface GuestPreviewPick {
	marketId: string;
	side: 'YES' | 'NO';
	ts: number;
}

export interface GuestState {
	isGuest: boolean;
	handle: string | null;
	sessionPickCount: number;
	previewPicks: GuestPreviewPick[];
}

const GUEST_STORAGE_KEY = 'vici:guest-session';

const EMPTY: GuestState = {
	isGuest: false,
	handle: null,
	sessionPickCount: 0,
	previewPicks: []
};

const readInitial = (): GuestState => {
	if (!browser) {
		return EMPTY;
	}

	try {
		const raw = localStorage.getItem(GUEST_STORAGE_KEY);

		if (isNullish(raw)) {
			return EMPTY;
		}

		const parsed: unknown = JSON.parse(raw);

		if (typeof parsed !== 'object' || isNullish(parsed)) {
			return EMPTY;
		}

		const value = parsed as Record<string, unknown>;
		const picks = Array.isArray(value.previewPicks)
			? value.previewPicks.filter(
					(p): p is GuestPreviewPick =>
						typeof p === 'object' &&
						nonNullish(p) &&
						typeof (p as GuestPreviewPick).marketId === 'string' &&
						((p as GuestPreviewPick).side === 'YES' || (p as GuestPreviewPick).side === 'NO')
				)
			: [];

		return {
			isGuest: value.isGuest === true,
			handle: typeof value.handle === 'string' ? value.handle : null,
			sessionPickCount: typeof value.sessionPickCount === 'number' ? value.sessionPickCount : 0,
			previewPicks: picks
		};
	} catch {
		return EMPTY;
	}
};

const persist = (state: GuestState): void => {
	if (!browser) {
		return;
	}

	try {
		if (!state.isGuest) {
			localStorage.removeItem(GUEST_STORAGE_KEY);

			return;
		}

		localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Best-effort: a guest session that can't persist still works for the
		// current page; the preview funnel is cosmetic relative to navigation.
	}
};

const store = writable<GuestState>(readInitial());

if (browser) {
	store.subscribe(persist);
}

export const guestStore = { subscribe: store.subscribe };

/**
 * Start a guest session from the onboarding Skip path. `handle` is the
 * auto-assigned or claimed name carried into conversion. Idempotent: re-entry
 * keeps the existing session (and its session pick count) intact.
 */
export const startGuestSession = (handle: string | null): void => {
	store.update((state) =>
		state.isGuest ? state : { isGuest: true, handle, sessionPickCount: 0, previewPicks: [] }
	);
};

/**
 * Record an in-session preview pick and advance the cadence counter. Captures
 * only what the nudges need (`marketId`, `side`, `ts`) — no entry price, no
 * stake — because nothing is reconciled at convert. No-op when not a guest.
 */
export const recordGuestPick = (pick: Omit<GuestPreviewPick, 'ts'>): void => {
	store.update((state) =>
		state.isGuest
			? {
					...state,
					sessionPickCount: state.sessionPickCount + 1,
					previewPicks: [...state.previewPicks, { ...pick, ts: Date.now() }]
				}
			: state
	);
};

/**
 * Clear the guest session entirely — the preview picks are discarded, never
 * drained into positions. Called on conversion and on a real sign-out.
 */
export const clearGuestSession = (): void => {
	store.set(EMPTY);
};
