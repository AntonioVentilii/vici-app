import { functions } from '$declarations/satellite/satellite.api';
import { listMyReferrals } from '$lib/services/referral.services';
import { loadGlobalStandings } from '$lib/services/standings.services';
import {
	myGlobalRankStore,
	myMenagerieSignalsLoaded,
	myReferralCountStore
} from '$lib/stores/menagerie.store';
import { userStore } from '$lib/stores/user.store';
import { isNullish } from '@dfinity/utils';
import { get } from 'svelte/store';

/**
 * Hydrates the live signals the Menagerie trophy layer needs beyond the
 * profile doc: the viewer's global rank + ranked-population size (Goat, via
 * the satellite's full-ranking self-rank query) and the viewer's referral
 * count (Parrot). The global `'all'` standings window is refreshed alongside
 * them — the profile dashboard's credibility line still reads it.
 *
 * Both the profile rail (`ProfileDashboard`) and the album route (`AlbumPage`)
 * call this on mount — it is the single hydration entry point so the two
 * surfaces read identical signals and a trophy can never show as earned in one
 * place and locked in the other (the bug this consolidates away). Best-effort:
 * the legs settle independently, so a failed referral fetch still leaves the
 * rank (and vice versa) populated rather than blocking the rail.
 */
// Shared in-flight load so the surfaces that hydrate on mount (profile rail,
// album grid, the always-mounted celebration host) coalesce into a single
// fetch instead of firing it once each. Cleared on settle so a later
// navigation still refreshes the signals.
let inFlight: Promise<void> | null = null;

export const loadMyMenagerieSignals = async (): Promise<void> => {
	if (inFlight !== null) {
		return inFlight;
	}

	inFlight = (async () => {
		try {
			await Promise.allSettled([
				loadGlobalStandings({ window: 'all' }),
				(async () => {
					const referrals = await listMyReferrals();
					myReferralCountStore.set(referrals.length);
				})(),
				(async () => {
					// The self-rank query covers the FULL ranking, so Goat resolves
					// for every ranked viewer on every surface — not only while the
					// cached top-50 leaderboard window happens to contain them.
					const owner = get(userStore).profile?.owner;

					if (isNullish(owner)) {
						return;
					}

					const { rank, count } = await functions.getUserRankAndCount({
						principalStr: owner
					});

					myGlobalRankStore.set({ rank, totalRanked: count });
				})()
			]);
		} finally {
			// Mark the attempt done either way — a failed leg degrades the affected
			// trophy to its baseline (locked) rather than holding the whole rail in
			// its skeleton state forever.
			myMenagerieSignalsLoaded.set(true);
		}
	})();

	try {
		await inFlight;
	} finally {
		inFlight = null;
	}
};
