import { Collection } from '$lib/constants/collections.constants';
import { leagueMemberKey, type LeagueMemberDoc } from '$lib/types/league-member';
import { leagueStatsKey, type LeagueStatsDoc } from '$lib/types/league-stats';
import type { UserProfile } from '$lib/types/profile';
import { isNullish, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import type { AssertSetDocContext, OnSetDocContext } from '@junobuild/functions';
import { time } from '@junobuild/functions/ic-cdk';
import {
	decodeDocData,
	encodeDocData,
	getDocStore,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';

/**
 * Pre-write guard for `league_stats`. Same shape rules as
 * `affiliation_stats` but simpler — lifetime counters only, no
 * monthly rollover (the tournament uses 7-day windows, not month
 * boundaries, so monthly snapshots aren't useful here).
 *
 *  1. **Collection scope.** No-op for any non-stats collection.
 *  2. **Key shape.** Doc key must equal the embedded `leagueId`.
 *  3. **Caller is a member.** The caller must have a row in
 *     `league_members` for the same leagueId. Binds the assert to
 *     legitimate hook writes — only a hook signing on behalf of an
 *     actual member can write, so an outsider can't inflate a rival
 *     league's numbers.
 *  4. **Counters move forward.** Lifetime counters cannot decrease
 *     across writes.
 *  5. **Wins ≤ totalCalls.** Sanity invariant.
 */
export const assertSetLeagueStats = ({
	caller,
	data: {
		collection,
		key,
		data: { current, proposed }
	}
}: AssertSetDocContext): void => {
	if (collection !== Collection.LEAGUE_STATS) {
		return;
	}

	const proposedDoc = decodeDocData<LeagueStatsDoc>(proposed.data);

	// 2. Key shape.
	const expectedKey = leagueStatsKey({ leagueId: proposedDoc.leagueId });

	if (key !== expectedKey) {
		throw new Error(
			`league_stats key mismatch: expected ${expectedKey}, got ${key} (leagueId must match the doc body).`
		);
	}

	// 3. Caller is a member of this league.
	const callerText = Principal.fromUint8Array(caller).toText();
	const membershipDoc = getDocStore({
		collection: Collection.LEAGUE_MEMBERS,
		key: leagueMemberKey({ leagueId: proposedDoc.leagueId, memberPrincipal: callerText }),
		caller
	});

	if (isNullish(membershipDoc)) {
		throw new Error(
			`league_stats writes require the caller to be a member of league "${proposedDoc.leagueId}".`
		);
	}

	// 5. Wins ≤ totalCalls — sanity invariant.
	if (proposedDoc.wins > proposedDoc.totalCalls) {
		throw new Error(
			`league_stats wins (${proposedDoc.wins}) cannot exceed totalCalls (${proposedDoc.totalCalls}).`
		);
	}

	if (proposedDoc.totalCalls < 0 || proposedDoc.wins < 0) {
		throw new Error('league_stats counters must be non-negative.');
	}

	// 4. Forward-only counters.
	if (nonNullish(current)) {
		const currentDoc = decodeDocData<LeagueStatsDoc>(current.data);

		if (proposedDoc.totalCalls < currentDoc.totalCalls) {
			throw new Error('league_stats totalCalls cannot decrease.');
		}

		if (proposedDoc.wins < currentDoc.wins) {
			throw new Error('league_stats wins cannot decrease.');
		}

		if (currentDoc.leagueId !== proposedDoc.leagueId) {
			throw new Error('league_stats leagueId is immutable.');
		}
	}
};

/**
 * Subset of the user profile fields the hook reads.
 */
interface ProfileStatsSlice {
	totalTrades?: number;
	winRate?: number;
}

const winsFromProfile = (slice: ProfileStatsSlice): number => {
	const trades = slice.totalTrades ?? 0;
	const rate = slice.winRate ?? 0;

	// Profile stores `winRate` as a percentage (0..100). Round to the
	// nearest integer count of wins. Lossy at extreme tails; acceptable
	// for an aggregate accuracy display.
	return Math.round((trades * rate) / 100);
};

/**
 * Post-write hook on `profiles`. Fires after every profile update;
 * detects whether `totalTrades` advanced (a trade resolved) and fans
 * the win/loss delta out to the user's league stats docs.
 *
 *  - First-write path (`before` is null): no delta to attribute.
 *  - Idempotent: a duplicate hook fire with identical before/after
 *    produces `Δtrades = 0` and writes nothing.
 *  - User can be a member of N leagues; the per-call cost is bounded
 *    by their league count.
 */
export const onProfileSetForLeagueStats = (ctx: OnSetDocContext): void => {
	const {
		caller,
		data: { collection, data }
	} = ctx;

	if (collection !== Collection.PROFILES) {
		return;
	}

	const { before, after } = data;

	if (isNullish(before)) {
		return;
	}

	let beforeProfile: ProfileStatsSlice;
	let afterProfile: UserProfile;

	try {
		beforeProfile = decodeDocData<UserProfile>(before.data);
		afterProfile = decodeDocData<UserProfile>(after.data);
	} catch {
		return;
	}

	const beforeTrades = beforeProfile.totalTrades ?? 0;
	const afterTrades = afterProfile.totalTrades ?? 0;
	const deltaTrades = afterTrades - beforeTrades;

	if (deltaTrades <= 0) {
		return;
	}

	const beforeWins = winsFromProfile(beforeProfile);
	const afterWins = winsFromProfile(afterProfile);
	const deltaWins = Math.max(0, Math.min(deltaTrades, afterWins - beforeWins));

	const callerText = Principal.fromUint8Array(caller).toText();
	const nowMs = Number(time() / 1_000_000n);

	// Scan league memberships for the caller. Key shape
	// `${leagueId}/${memberPrincipal}` — filter on the suffix.
	const { items } = listDocsStore({
		collection: Collection.LEAGUE_MEMBERS,
		caller,
		params: {}
	});

	const suffix = `/${callerText}`;

	for (const [memberKey, item] of items) {
		if (memberKey.endsWith(suffix)) {
			let memberDoc: LeagueMemberDoc | undefined;

			try {
				memberDoc = decodeDocData<LeagueMemberDoc>(item.data);
			} catch {
				memberDoc = undefined;
			}

			if (nonNullish(memberDoc) && memberDoc.member === callerText) {
				incrementLeagueStats({
					caller,
					leagueId: memberDoc.leagueId,
					deltaTrades,
					deltaWins,
					nowMs
				});
			}
		}
	}
};

/**
 * Apply a (deltaTrades, deltaWins) increment to a single league's
 * rolling stats doc. Creates the doc on first write; reads
 * + bumps + writes otherwise.
 */
const incrementLeagueStats = ({
	caller,
	leagueId,
	deltaTrades,
	deltaWins,
	nowMs
}: {
	caller: Uint8Array;
	leagueId: string;
	deltaTrades: number;
	deltaWins: number;
	nowMs: number;
}): void => {
	const docKey = leagueStatsKey({ leagueId });
	const existing = getDocStore({
		collection: Collection.LEAGUE_STATS,
		key: docKey,
		caller
	});

	const baseDoc: LeagueStatsDoc = isNullish(existing)
		? {
				leagueId,
				totalCalls: 0,
				wins: 0,
				updatedAtMs: nowMs
			}
		: decodeDocData<LeagueStatsDoc>(existing.data);

	const next: LeagueStatsDoc = {
		...baseDoc,
		totalCalls: baseDoc.totalCalls + deltaTrades,
		wins: baseDoc.wins + deltaWins,
		updatedAtMs: nowMs
	};

	setDocStore({
		collection: Collection.LEAGUE_STATS,
		key: docKey,
		caller,
		doc: {
			data: encodeDocData(next),
			version: existing?.version
		}
	});
};

/**
 * Read a single league's current stats. Returns `undefined` when no
 * doc exists yet (a brand-new league with no resolved trades).
 */
export const getLeagueStatsFn = ({
	leagueId,
	caller
}: {
	leagueId: string;
	caller: Uint8Array;
}): LeagueStatsDoc | undefined => {
	const doc = getDocStore({
		collection: Collection.LEAGUE_STATS,
		key: leagueStatsKey({ leagueId }),
		caller
	});

	if (isNullish(doc)) {
		return;
	}

	try {
		return decodeDocData<LeagueStatsDoc>(doc.data);
	} catch {
		// Malformed payload — fall through to undefined.
	}
};
