import { listMyReferrals } from '$lib/services/referral.services';
import { loadGlobalStandings } from '$lib/services/standings.services';
import { myMenagerieSignalsLoaded, myReferralCountStore } from '$lib/stores/menagerie.store';

/**
 * Hydrates the two live signals the Menagerie trophy layer needs beyond the
 * profile doc: the global `'all'` standings window (the ranked-population size
 * behind Goat's percentile) and the viewer's referral count (Parrot).
 *
 * Both the profile rail (`ProfileDashboard`) and the album route (`AlbumPage`)
 * call this on mount — it is the single hydration entry point so the two
 * surfaces read identical signals and a trophy can never show as earned in one
 * place and locked in the other (the bug this consolidates away). Best-effort:
 * the two legs settle independently, so a failed referral fetch still leaves
 * the standings (and vice versa) populated rather than blocking the rail.
 */
// Shared in-flight load so the surfaces that hydrate on mount (profile rail,
// album grid, the always-mounted celebration host) coalesce into a single
// standings + referral fetch instead of firing it once each. Cleared on settle
// so a later navigation still refreshes the signals.
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
