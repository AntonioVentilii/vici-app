import { listMyReferrals } from '$lib/services/referral.services';
import type { ReferralListItem } from '$lib/types/referral';
import { writable } from 'svelte/store';

/**
 * Reactive cache of the viewer's referral redemptions (rows where the caller
 * is the referrer), newest-first.
 *
 * Single source of truth shared by the Dash stack-sheet breakdown and the
 * Arena invite hero so the "friends joined / VXP earned" figures can never
 * disagree, and so navigating between the two surfaces reuses the already
 * fetched list instead of re-querying on every mount. Mirrors the
 * stale-while-revalidate contract of `friends.store`: the cached value stays
 * put across navigation and is refreshed in the background on each visit.
 */
export const myReferralsStore = writable<ReferralListItem[]>([]);

/**
 * Flips to `true` the first time `refreshMyReferrals` completes for the
 * current principal and stays `true` until `clearMyReferrals` runs (i.e. the
 * principal changes). Lets consumers show a skeleton only on the cold load and
 * keep showing the cached figure while a background refresh is in flight.
 */
export const myReferralsLoadedStore = writable<boolean>(false);

let inFlight: Promise<void> | undefined;

const runRefresh = async (): Promise<void> => {
	const items = await listMyReferrals();

	myReferralsStore.set(items);
	myReferralsLoadedStore.set(true);
};

/**
 * Refetches the viewer's referral rows into the shared store. Same-tick
 * concurrent callers (e.g. Dash and Arena mounting together) share the
 * in-flight promise so we don't issue duplicate query calls. Fail-open: a
 * rejected fetch leaves the previous cache untouched and never flips the
 * loaded flag, so a cold failure keeps showing the skeleton rather than a
 * misleading zero.
 */
export const refreshMyReferrals = async (): Promise<void> => {
	if (inFlight) {
		await inFlight;

		return;
	}

	const current = runRefresh().finally(() => {
		inFlight = undefined;
	});
	inFlight = current;

	await current;
};

export const clearMyReferrals = (): void => {
	myReferralsStore.set([]);
	myReferralsLoadedStore.set(false);
};
