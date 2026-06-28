import { Collection } from '$lib/constants/collections.constants';
import { affiliationKey, type AffiliationDoc, type AffiliationKind } from '$lib/types/affiliation';
import {
	affiliationStatsKey,
	affiliationStatsSnapshotKey,
	monthAnchorFromMs,
	type AffiliationStatsDoc
} from '$lib/types/affiliation-stats';
import type { UserProfile } from '$lib/types/profile';
import { readAffiliationDoc } from '$satellite/services/cohort.services';
import { isHibernated } from '$satellite/services/profile.services';
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
 * Pre-write guard for `affiliation_stats`.
 *
 *  1. **Collection scope.** No-op for any non-stats collection.
 *  2. **Key shape.** The doc key must equal
 *     `${kind}/${affiliationIdentifier}` and match the doc body's
 *     `(kind, affiliationIdentifier)`.
 *  3. **Caller is a member.** The caller must have a row in
 *     `affiliations` for the same `(kind, affiliationIdentifier)`. This binds
 *     the assert to legitimate hook writes — only a hook signing on
 *     behalf of an actual affiliate can write the stats doc, which
 *     means random users can't inflate a rival school's numbers.
 *  4. **Counters move forward.** Lifetime / monthly counters cannot
 *     decrease across writes (except when `monthAnchor` advances — a
 *     valid month rollover resets `monthTotalCalls` / `monthWins` to
 *     zero before re-incrementing).
 *  5. **Wins ≤ totalCalls** on both windows. Sanity invariant.
 */
export const assertSetAffiliationStats = ({
	caller,
	data: {
		collection,
		key,
		data: { current, proposed }
	}
}: AssertSetDocContext): void => {
	if (collection !== Collection.AFFILIATION_STATS) {
		return;
	}

	const proposedDoc = decodeDocData<AffiliationStatsDoc>(proposed.data);

	// 2. Key shape — two valid shapes:
	//    - Rolling (current month): `${kind}/${affiliationIdentifier}` — 2 segments
	//    - Frozen snapshot (past month): `${kind}/${affiliationIdentifier}/${monthAnchor}` — 3 segments
	const rollingKey = affiliationStatsKey({
		kind: proposedDoc.kind,
		affiliationIdentifier: proposedDoc.affiliationIdentifier
	});
	const snapshotKey = affiliationStatsSnapshotKey({
		kind: proposedDoc.kind,
		affiliationIdentifier: proposedDoc.affiliationIdentifier,
		monthAnchor: proposedDoc.monthAnchor
	});

	const isSnapshot = key === snapshotKey;

	if (key !== rollingKey && !isSnapshot) {
		throw new Error(
			`affiliation_stats key mismatch: expected ${rollingKey} or ${snapshotKey}, got ${key}.`
		);
	}

	// Snapshot docs are write-once. They represent a closed historical
	// month — any later write would let a malicious member rewrite
	// history. Reject every non-create write on a snapshot key.
	if (isSnapshot && nonNullish(current)) {
		throw new Error(
			`affiliation_stats snapshot ${key} is write-once; the month has already closed.`
		);
	}

	// 3. Caller is a member of this affiliation.
	const callerText = Principal.fromUint8Array(caller).toText();
	const membershipKey = affiliationKey({
		memberPrincipal: callerText,
		kind: proposedDoc.kind,
		affiliationIdentifier: proposedDoc.affiliationIdentifier
	});
	const membershipDoc = getDocStore({
		collection: Collection.AFFILIATIONS,
		key: membershipKey,
		caller
	});

	if (isNullish(membershipDoc)) {
		throw new Error(
			`affiliation_stats writes require the caller to be a member of ${proposedDoc.kind}/${proposedDoc.affiliationIdentifier}.`
		);
	}

	// 5. Wins ≤ totalCalls — sanity invariant on both windows.
	if (proposedDoc.wins > proposedDoc.totalCalls) {
		throw new Error(
			`affiliation_stats wins (${proposedDoc.wins}) cannot exceed totalCalls (${proposedDoc.totalCalls}).`
		);
	}

	if (proposedDoc.monthWins > proposedDoc.monthTotalCalls) {
		throw new Error(
			`affiliation_stats monthWins (${proposedDoc.monthWins}) cannot exceed monthTotalCalls (${proposedDoc.monthTotalCalls}).`
		);
	}

	if (proposedDoc.totalCalls < 0 || proposedDoc.wins < 0) {
		throw new Error('affiliation_stats lifetime counters must be non-negative.');
	}

	// 4. Forward-only counters (per window).
	if (nonNullish(current)) {
		const currentDoc = decodeDocData<AffiliationStatsDoc>(current.data);

		if (proposedDoc.totalCalls < currentDoc.totalCalls) {
			throw new Error('affiliation_stats lifetime totalCalls cannot decrease.');
		}

		if (proposedDoc.wins < currentDoc.wins) {
			throw new Error('affiliation_stats lifetime wins cannot decrease.');
		}

		// Monthly counters can decrease iff the monthAnchor advanced
		// (the lazy rollover resets them to ≤ previous values + delta).
		if (proposedDoc.monthAnchor === currentDoc.monthAnchor) {
			if (proposedDoc.monthTotalCalls < currentDoc.monthTotalCalls) {
				throw new Error(
					'affiliation_stats monthTotalCalls cannot decrease within the same monthAnchor.'
				);
			}

			if (proposedDoc.monthWins < currentDoc.monthWins) {
				throw new Error('affiliation_stats monthWins cannot decrease within the same monthAnchor.');
			}
		} else if (proposedDoc.monthAnchor < currentDoc.monthAnchor) {
			throw new Error(
				`affiliation_stats monthAnchor cannot move backward (${currentDoc.monthAnchor} → ${proposedDoc.monthAnchor}).`
			);
		}

		// Identity fields are immutable.
		if (
			currentDoc.kind !== proposedDoc.kind ||
			currentDoc.affiliationIdentifier !== proposedDoc.affiliationIdentifier
		) {
			throw new Error('affiliation_stats kind / affiliationIdentifier are immutable.');
		}
	}
};

/**
 * Subset of the user profile fields the hook reads. Decoded from the
 * satellite doc payload — we don't need the full `UserProfile` shape.
 */
interface ProfileStatsSlice {
	totalTrades?: number;
	winRate?: number;
}

const winsFromProfile = (slice: ProfileStatsSlice): number => {
	const trades = slice.totalTrades ?? 0;
	const rate = slice.winRate ?? 0;

	// Profile stores `winRate` as a percentage (0..100). Round to the
	// nearest integer count of wins; this is lossy at extreme tails
	// (1000 trades × 73.4% = 734 wins, but the stored rate may quantise
	// to a slightly different integer count). Acceptable for an
	// aggregate accuracy display; if drift accumulates we can switch
	// to a per-event activity hook later.
	return Math.round((trades * rate) / 100);
};

/**
 * Post-write hook on `profiles`. Fires after every profile update;
 * detects whether `totalTrades` advanced (a trade resolved) and
 * fans the win/loss delta out to the user's affiliation stats docs.
 *
 *  - First-write path (`before` is null) does nothing — there's no
 *    delta to compute and a new profile has no resolved trades yet
 *    by definition.
 *  - Idempotent: the delta is computed from the before/after pair,
 *    so a duplicate hook fire with identical before/after produces
 *    `Δtrades = 0` and writes nothing.
 *  - Lazy month rollover: if the current calendar month no longer
 *    matches the stats doc's `monthAnchor`, the doc is rolled over
 *    (monthly counters reset; lifetime counters preserved) before
 *    the increment.
 *  - User has at most two affiliations (university + country), so
 *    the per-call cost is bounded.
 */
export const onProfileSetForAffiliationStats = (ctx: OnSetDocContext): void => {
	const {
		caller,
		data: { collection, data }
	} = ctx;

	if (collection !== Collection.PROFILES) {
		return;
	}

	const { before, after } = data;

	if (isNullish(before)) {
		// First-time profile creation has no resolved trades; nothing
		// to attribute.
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

	// Stats freeze (Delete account v2). A hibernated account must not move
	// shared stats. In practice a hibernated user is inactive (no trades →
	// no profile writes), so this is a defensive guard against a stray
	// profile write while hibernated fanning out a delta. The `after`
	// profile is already decoded above, so the check is free. Note this
	// can't suppress the legitimate `resumeMyAccount` write: clearing
	// `hibernatedAtMs` leaves `totalTrades` unchanged, so `deltaTrades`
	// would be 0 anyway — and on resume the AFTER profile is no longer
	// hibernated, so it passes this guard too.
	if (isHibernated(afterProfile)) {
		return;
	}

	// Honor the "Show in Worlds Universities" opt-out. A user who turned it
	// off stops contributing their resolved-trade delta to their school /
	// country aggregate. Nullish (legacy rows / default) reads as opted-in,
	// matching the always-shown default. This gates FUTURE contribution only —
	// `AFFILIATION_STATS` is a forward-only aggregate with no per-member
	// breakdown, so a past contribution can't be subtracted here.
	if (afterProfile.preferences?.sharing?.worldsOptIn === false) {
		return;
	}

	const beforeTrades = beforeProfile.totalTrades ?? 0;
	const afterTrades = afterProfile.totalTrades ?? 0;
	const deltaTrades = afterTrades - beforeTrades;

	if (deltaTrades <= 0) {
		// No new resolutions — the profile update was for some other
		// field (nickname, interests, etc.). Skip.
		return;
	}

	const beforeWins = winsFromProfile(beforeProfile);
	const afterWins = winsFromProfile(afterProfile);
	const deltaWins = Math.max(0, Math.min(deltaTrades, afterWins - beforeWins));

	// Caller is the user whose profile just updated. Their
	// affiliations are keyed `${caller}/${kind}/${affiliationIdentifier}` — at
	// most two rows (one per kind). We try both possibilities; if a
	// row is missing the kind, we skip.
	const callerText = Principal.fromUint8Array(caller).toText();
	const kinds: AffiliationKind[] = ['university', 'country'];
	const nowMs = Number(time() / 1_000_000n);
	const anchor = monthAnchorFromMs(nowMs);

	// Scan the affiliations collection once and bucket by kind. We
	// can't keyed-lookup without knowing the affiliationIdentifier, so this
	// scan is N=members + filter; for the satellite's expected volume
	// this is bounded by the active membership total.
	const { items } = listDocsStore({
		collection: Collection.AFFILIATIONS,
		caller,
		params: {}
	});

	for (const [memberKey, item] of items) {
		const matchingKind = kinds.find((k) => memberKey.startsWith(`${callerText}/${k}/`));

		if (isNullish(matchingKind)) {
			// Membership row for a different user — skip.
		} else {
			let memberDoc: AffiliationDoc | undefined;

			try {
				memberDoc = readAffiliationDoc(item.data);
			} catch {
				// Malformed payload — skip this row.
				memberDoc = undefined;
			}

			if (nonNullish(memberDoc) && memberDoc.kind === matchingKind) {
				incrementStats({
					caller,
					kind: matchingKind,
					affiliationIdentifier: memberDoc.affiliationIdentifier,
					deltaTrades,
					deltaWins,
					anchor,
					nowMs
				});
			}
		}
	}
};

const incrementStats = ({
	caller,
	kind,
	affiliationIdentifier,
	deltaTrades,
	deltaWins,
	anchor,
	nowMs
}: {
	caller: Uint8Array;
	kind: AffiliationKind;
	affiliationIdentifier: string;
	deltaTrades: number;
	deltaWins: number;
	anchor: string;
	nowMs: number;
}): void => {
	const key = affiliationStatsKey({ kind, affiliationIdentifier });
	const existing = getDocStore({
		collection: Collection.AFFILIATION_STATS,
		key,
		caller
	});

	const prev: AffiliationStatsDoc | undefined = nonNullish(existing)
		? (() => {
				try {
					return decodeDocData<AffiliationStatsDoc>(existing.data);
				} catch {
					// Malformed payload — bypass the previous doc and start fresh.
				}
			})()
		: undefined;

	// Lazy month rollover: if the previous doc's anchor is older than
	// the current month, freeze a snapshot of the just-completed
	// month BEFORE zeroing the rolling doc's monthly counters. Lifetime
	// counters carry forward. The snapshot is what Worlds podium reads
	// to compute top-3 for a closed month.
	const rolledOver = nonNullish(prev) && prev.monthAnchor !== anchor;

	if (rolledOver && nonNullish(prev)) {
		const snapshotKey = affiliationStatsSnapshotKey({
			kind,
			affiliationIdentifier,
			monthAnchor: prev.monthAnchor
		});
		const existingSnapshot = getDocStore({
			collection: Collection.AFFILIATION_STATS,
			key: snapshotKey,
			caller
		});

		// Only write the snapshot if one doesn't already exist for that
		// month — the first caller of the new month to land here wins;
		// subsequent rollovers from other users for the same affiliation
		// in the same hop see the snapshot already in place and skip.
		if (isNullish(existingSnapshot)) {
			setDocStore({
				collection: Collection.AFFILIATION_STATS,
				key: snapshotKey,
				caller,
				doc: {
					data: encodeDocData({
						...prev,
						updatedAtMs: nowMs
					})
				}
			});
		}
	}

	const base: AffiliationStatsDoc = nonNullish(prev)
		? rolledOver
			? {
					...prev,
					monthAnchor: anchor,
					monthTotalCalls: 0,
					monthWins: 0
				}
			: prev
		: {
				affiliationIdentifier,
				kind,
				totalCalls: 0,
				wins: 0,
				monthAnchor: anchor,
				monthTotalCalls: 0,
				monthWins: 0,
				updatedAtMs: nowMs
			};

	const next: AffiliationStatsDoc = {
		...base,
		totalCalls: base.totalCalls + deltaTrades,
		wins: base.wins + deltaWins,
		monthTotalCalls: base.monthTotalCalls + deltaTrades,
		monthWins: base.monthWins + deltaWins,
		updatedAtMs: nowMs
	};

	setDocStore({
		collection: Collection.AFFILIATION_STATS,
		key,
		caller,
		doc: {
			data: encodeDocData(next),
			version: existing?.version
		}
	});
};
