import { writable } from 'svelte/store';

/**
 * The signed-in viewer's referral count — the live signal behind the Parrot
 * trophy. The profile doc doesn't carry it, so it's fetched once and cached
 * here rather than re-counted independently by every surface that renders the
 * Menagerie. `undefined` falls back to a zero baseline in the stats derive.
 *
 * Hydrated by `loadMyMenagerieSignals` (see `menagerie.services`).
 */
export const myReferralCountStore = writable<number | undefined>(undefined);

/**
 * `true` once `loadMyMenagerieSignals` has finished its first hydration attempt
 * (success OR failure). The trophy rail reads this — not the individual data
 * stores — as its load gate, so a failed standings / referral fetch resolves to
 * the real (possibly locked) tiers rather than stranding the rail in a
 * perpetual skeleton. Sticks `true` across navigation once set.
 */
export const myMenagerieSignalsLoaded = writable<boolean>(false);
