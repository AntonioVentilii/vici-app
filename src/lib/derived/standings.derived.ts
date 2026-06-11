import { profilesStore } from '$lib/stores/profiles.store';
import { globalStandingsStore } from '$lib/stores/standings.store';
import { userStore } from '$lib/stores/user.store';
import type { UserProfile } from '$lib/types/profile';
import type { StandingEntry, StandingsWindow } from '$lib/types/standings';
import type { PrincipalText } from '@junobuild/schema';
import { derived, type Readable } from 'svelte/store';

/**
 * Minimum settled calls a predictor needs before their accuracy can lift them
 * up the leaderboard. Below this floor a single lucky 100%-on-1-call result
 * would otherwise take #1 over a seasoned predictor on 80%-of-200 — the whole
 * point of the board is being right repeatedly, so we hold low-sample
 * predictors below everyone who has cleared the floor.
 */
const LEADERBOARD_MIN_SETTLED = 3;

/**
 * Accuracy-first ordering for the leaderboard view.
 *
 * The leaderboard ranks by accuracy — being right is the score. The clearing
 * canister hands us the slice ranked by net realized P&L (a high-stakes loss
 * can outrank a quiet 100%), so we re-rank it here on the FE for this surface
 * only. Other consumers of the same cached slice (the Dash "Top X%" rank tile,
 * `findOwnStanding`) deliberately keep the canister's P&L rank — see
 * `standings.services`.
 *
 *  1. Qualified (settled ≥ floor) always rank above below-floor predictors, so
 *     a 1-call 100% can't leapfrog a proven track record.
 *  2. Within qualified: accuracy desc → settledCount desc (more proof breaks an
 *     accuracy tie) → realizedPnl desc → stable.
 *  3. Within below-floor: settledCount desc → accuracy desc, so new / low-sample
 *     predictors settle to the bottom in a stable, sensible order.
 *
 * Stable: equal entries fall through to the input order (the canister's
 * tiebreak), so the sort is deterministic.
 */
// eslint-disable-next-line local-rules/prefer-object-params -- compare functions read best with positional params
const byAccuracy = (a: StandingEntry, b: StandingEntry): number => {
	const aQualified = a.settledCount >= LEADERBOARD_MIN_SETTLED;
	const bQualified = b.settledCount >= LEADERBOARD_MIN_SETTLED;

	if (aQualified !== bQualified) {
		return aQualified ? -1 : 1;
	}

	if (aQualified) {
		if (b.accuracy !== a.accuracy) {
			return b.accuracy - a.accuracy;
		}

		if (b.settledCount !== a.settledCount) {
			return b.settledCount - a.settledCount;
		}

		// `realizedPnl` is a signed bigint — compare directly, never via Number.
		if (a.realizedPnl !== b.realizedPnl) {
			return b.realizedPnl > a.realizedPnl ? 1 : -1;
		}

		return 0;
	}

	if (b.settledCount !== a.settledCount) {
		return b.settledCount - a.settledCount;
	}

	return b.accuracy - a.accuracy;
};

/**
 * A ranked standings row joined with the predictor's display identity. The
 * accuracy-ordered position (`displayRank`) and the underlying figures
 * (accuracy, P&L, settled count) are authoritative; the handle / avatar /
 * streak are overlaid from the shared profile cache, with the viewer's own row
 * taking the freshest values from `userStore.profile` so they never see a stale
 * handle for themselves.
 */
export interface StandingsRow {
	entry: StandingEntry;
	owner: PrincipalText;
	/**
	 * 1-based position in the accuracy-ordered list — NOT `entry.rank` (the
	 * canister's P&L rank). This is the number the leaderboard renders.
	 */
	displayRank: number;
	nickname: string | undefined;
	avatar: string | undefined;
	/** Serialized faceted-avatar picks — lets the row render the predictor's
	 *  saved face instead of the principal-seeded fallback. */
	avatarParts: string | undefined;
	/**
	 * Consecutive active days (the Flame engine) — the leaderboard renders
	 * this as "{n}d streak", so it must be the days-based counter, not the
	 * consecutive-wins `streak` field.
	 */
	dailyStreak: number;
	isSelf: boolean;
}

const toRow = ({
	entry,
	displayRank,
	profile,
	self,
	selfProfile
}: {
	entry: StandingEntry;
	displayRank: number;
	profile: UserProfile | undefined;
	self: boolean;
	selfProfile: UserProfile | undefined;
}): StandingsRow => {
	const source = self ? (selfProfile ?? profile) : profile;

	return {
		entry,
		owner: entry.owner,
		displayRank,
		nickname: source?.nickname,
		avatar: source?.avatar,
		avatarParts: source?.avatarParts,
		dailyStreak: source?.dailyStreak ?? 0,
		isSelf: self
	};
};

/**
 * Builds a readable of joined {@link StandingsRow}s for one window's cached
 * global standings, ordered by accuracy (see {@link byAccuracy}). `undefined`
 * while the window has not yet loaded (distinct from a loaded-but-empty window,
 * which is `[]`).
 *
 * This re-ranks the *fetched slice* — the canister returns the top-N by net
 * P&L, so re-sorting it by accuracy here is correct only while the whole user
 * base fits within the fetched pages. At scale, accuracy ranking should move
 * into the clearing canister (`list_leaderboard`) so high-accuracy /
 * low-P&L predictors aren't dropped from the slice before the FE ever sees them.
 */
export const globalStandingsRows = (
	window: StandingsWindow
): Readable<StandingsRow[] | undefined> =>
	derived(
		[globalStandingsStore, profilesStore, userStore],
		([$standings, $profiles, { user, profile }]) => {
			const result = $standings.get(window);

			if (result === undefined) {
				return;
			}

			const selfOwner = user?.owner;

			// Copy before sorting — never mutate the cached slice in place.
			return [...result.entries].sort(byAccuracy).map((entry, i) =>
				toRow({
					entry,
					// 1-based position in the accuracy order, not the canister rank.
					displayRank: i + 1,
					profile: $profiles.get(entry.owner),
					self: entry.owner === selfOwner,
					selfProfile: profile
				})
			);
		}
	);
