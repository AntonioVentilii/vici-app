import { leaderboard, leaderboardNotInitialized } from '$lib/derived/leaderboard.derived';
import { myMenagerieSignalsLoaded, myReferralCountStore } from '$lib/stores/menagerie.store';
import { globalStandingsStore } from '$lib/stores/standings.store';
import { userStore } from '$lib/stores/user.store';
import {
	menagerieRows,
	menagerieStatsFromProfile,
	type MenagerieRow,
	type MenagerieStats
} from '$lib/utils/menagerie.utils';
import { derived, type Readable } from 'svelte/store';

/**
 * The signed-in viewer's live Menagerie metric snapshot — the SINGLE source of
 * truth for the trophy layer. Both the profile rail (`ProfileDashboard`) and
 * the album route (`AlbumPage`) read from here, so the same animal can never
 * resolve to a different tier across the two surfaces.
 *
 * Goat's global-rank signal is the viewer's 1-based index in the points
 * `leaderboard` — the row they are reliably in, and the same source the
 * profile's "Top X%" credibility line uses — with the ranked-population size
 * from the cached `'all'` standings window as the percentile denominator.
 * Reading rank from the standings window directly (as the album route used to)
 * left the viewer unranked there whenever they had no settled position in that
 * window, which is exactly how Goat read earned on the profile yet locked on
 * the album. Parrot's referral count comes from the shared
 * `myReferralCountStore`. Both extra signals are hydrated by
 * `loadMyMenagerieSignals` (see `menagerie.services`).
 */
export const myMenagerieStats: Readable<MenagerieStats> = derived(
	[userStore, leaderboard, globalStandingsStore, myReferralCountStore],
	([{ profile }, $leaderboard, $standings, $referrals]) => {
		const owner = profile?.owner;
		const idx = owner === undefined ? -1 : $leaderboard.findIndex((entry) => entry.owner === owner);

		return menagerieStatsFromProfile({
			profile,
			signals: {
				referrals: $referrals ?? 0,
				rank: idx === -1 ? undefined : idx + 1,
				// The window's `total` is the full ranked population; `entries` is only
				// the fetched (paged-capped) slice, so its length undercounts and would
				// inflate the percentile → over-grant Goat's tier.
				totalRanked: $standings.get('all')?.total
			}
		});
	}
);

/**
 * The full catalogue decorated with each animal's live tier + progress, sorted
 * earned-first — the identical ordering the profile rail and the album grid
 * both render.
 */
export const myMenagerieRows: Readable<MenagerieRow[]> = derived(myMenagerieStats, ($stats) =>
	menagerieRows($stats)
);

/**
 * `true` while the rank / referral signals are still resolving. Both surfaces
 * render skeleton tiles until this settles, so a not-yet-loaded rank never
 * flashes as a grey "locked" trophy. It clears once the leaderboard cache has
 * initialised (the rank source) AND `loadMyMenagerieSignals` has finished its
 * first hydration attempt — a failed fetch still clears the gate (degrading the
 * affected trophy to its baseline) rather than stranding the rail in skeleton.
 */
export const myMenagerieLoading: Readable<boolean> = derived(
	[leaderboardNotInitialized, myMenagerieSignalsLoaded],
	([$leaderboardNotInitialized, $signalsLoaded]) => $leaderboardNotInitialized || !$signalsLoaded
);
