import { profilesStore } from '$lib/stores/profiles.store';
import { globalStandingsStore } from '$lib/stores/standings.store';
import { userStore } from '$lib/stores/user.store';
import type { UserProfile } from '$lib/types/profile';
import type { StandingEntry, StandingsWindow } from '$lib/types/standings';
import type { PrincipalText } from '@junobuild/schema';
import { derived, type Readable } from 'svelte/store';

/**
 * A ranked standings row joined with the predictor's display identity. The
 * standing (rank, delta, accuracy, P&L) is authoritative from the clearing
 * canister; the handle / avatar / streak are overlaid from the shared profile
 * cache, with the viewer's own row taking the freshest values from
 * `userStore.profile` so they never see a stale handle for themselves.
 */
export interface StandingsRow {
	entry: StandingEntry;
	owner: PrincipalText;
	nickname: string | undefined;
	avatar: string | undefined;
	streak: number;
	isSelf: boolean;
}

const toRow = ({
	entry,
	profile,
	self,
	selfProfile
}: {
	entry: StandingEntry;
	profile: UserProfile | undefined;
	self: boolean;
	selfProfile: UserProfile | undefined;
}): StandingsRow => {
	const source = self ? (selfProfile ?? profile) : profile;

	return {
		entry,
		owner: entry.owner,
		nickname: source?.nickname,
		avatar: source?.avatar,
		streak: source?.streak ?? 0,
		isSelf: self
	};
};

/**
 * Builds a readable of joined {@link StandingsRow}s for one window's cached
 * global standings, in ascending rank. `undefined` while the window has not
 * yet loaded (distinct from a loaded-but-empty window, which is `[]`).
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

			return result.entries.map((entry) =>
				toRow({
					entry,
					profile: $profiles.get(entry.owner),
					self: entry.owner === selfOwner,
					selfProfile: profile
				})
			);
		}
	);
