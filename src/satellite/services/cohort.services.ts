import { Collection } from '$lib/constants/collections.constants';
import { RelationCategory, RelationState } from '$lib/enums/relation';
import type { AffiliationDoc, AffiliationKind } from '$lib/types/affiliation';
import {
	affiliationStatsKey,
	MIN_CALLS_FOR_RANK,
	type AffiliationStatsDoc
} from '$lib/types/affiliation-stats';
import type { BattleDoc } from '$lib/types/battle';
import {
	isLeaguePubliclyListed,
	isLeagueRecommendableToFriends,
	type LeagueDoc
} from '$lib/types/league';
import type { LeagueMemberDoc } from '$lib/types/league-member';
import type { Relation } from '$lib/types/relation';
import { isNullish, nonNullish } from '@dfinity/utils';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import { decodeDocData, getDocStore, listDocsStore } from '@junobuild/functions/sdk';

/**
 * Service-layer aggregation for the social-cohort surface. Pure
 * read helpers over the `leagues` + `league_members` collections;
 * exposed as `defineQuery` endpoints in `satellite/index.ts`.
 *
 * Mutations live in `league.services.ts` / `league-member.services.ts`
 * via the assert path — this file is read-only.
 */

/**
 * Shared affiliation-rank comparator factory. The Worlds leaderboard,
 * the monthly podium fan-out, and the per-affiliation championship
 * history all rank stats docs by the SAME rule:
 *
 *   accuracy desc → calls desc (rewards depth) → affiliationIdentifier asc
 *   (deterministic tie-break across re-runs)
 *
 * The lifetime surface feeds `wins / totalCalls` + `totalCalls`; the
 * monthly surfaces feed `monthWins / monthTotalCalls` + `monthTotalCalls`.
 * Both pass the matching accessors here so the three ranking surfaces
 * provably can't diverge. Pure — no I/O; the returned comparator closes
 * over the provided accessors and nothing else.
 */
const compareAffiliationRank =
	({
		accuracyOf,
		callsOf
	}: {
		accuracyOf: (doc: AffiliationStatsDoc) => number;
		callsOf: (doc: AffiliationStatsDoc) => number;
	}): ((a: AffiliationStatsDoc, b: AffiliationStatsDoc) => number) =>
	// eslint-disable-next-line local-rules/prefer-object-params -- Array.sort comparators take two positional args by contract
	(a, b) => {
		const aAcc = accuracyOf(a);
		const bAcc = accuracyOf(b);

		if (aAcc !== bAcc) {
			return bAcc - aAcc;
		}

		const aCalls = callsOf(a);
		const bCalls = callsOf(b);

		if (aCalls !== bCalls) {
			return bCalls - aCalls;
		}

		return a.affiliationIdentifier < b.affiliationIdentifier
			? -1
			: a.affiliationIdentifier > b.affiliationIdentifier
				? 1
				: 0;
	};

/** Hydrated `LeagueDoc` paired with the caller's role inside it. */
export interface LeagueWithRole {
	league: LeagueDoc;
	role: LeagueMemberDoc['role'];
	joinedAtMs: number;
	/**
	 * Total membership count of the league (owner included), tallied
	 * inline from the same `LEAGUE_MEMBERS` scan that resolves the
	 * caller's memberships — no extra read. Drives the `league-founder`
	 * achievement (owner of a league with ≥3 members).
	 */
	memberCount: number;
}

/**
 * Return every league the caller is a member of, paired with the
 * membership row's role + joinedAtMs.
 *
 * Two scans because juno's listDocs has no SQL-style join: first
 * `league_members` filtered to rows where `member === callerText`,
 * then `getDocStore` each parent league. The membership table is
 * the source of truth for "am I in this league?" — joining off the
 * league.owner field would miss leagues where the caller is an
 * `admin` / `member` not `owner`.
 *
 * Sorted by `joinedAtMs` descending so the most recently-joined
 * league surfaces first.
 */
export const listMyLeaguesFn = (): LeagueWithRole[] => {
	const caller = msgCaller();
	const callerText = caller.toText();
	const callerBytes = caller.toUint8Array();

	const { items } = listDocsStore({
		collection: Collection.LEAGUE_MEMBERS,
		caller: callerBytes,
		params: {}
	});

	const myMemberships: { leagueId: string; role: LeagueMemberDoc['role']; joinedAtMs: number }[] =
		[];
	// Tally total members per league from the same scan so the
	// `memberCount` on each hydrated row costs no extra read.
	const memberCounts = new Map<string, number>();

	for (const [, item] of items) {
		try {
			const member = decodeDocData<LeagueMemberDoc>(item.data);

			memberCounts.set(member.leagueId, (memberCounts.get(member.leagueId) ?? 0) + 1);

			if (member.member === callerText) {
				myMemberships.push({
					leagueId: member.leagueId,
					role: member.role,
					joinedAtMs: member.joinedAtMs
				});
			}
		} catch {
			// Malformed rows should never have passed the assert; skip silently.
		}
	}

	const hydrated: LeagueWithRole[] = [];

	for (const m of myMemberships) {
		const leagueDoc = getDocStore({
			collection: Collection.LEAGUES,
			key: m.leagueId,
			caller: callerBytes
		});

		// Skip orphaned rows where the parent league is missing —
		// `assertDeleteLeagueMember` tolerates orphans, so this read
		// side mirrors that policy.
		if (nonNullish(leagueDoc)) {
			try {
				const league = decodeDocData<LeagueDoc>(leagueDoc.data);
				hydrated.push({
					league,
					role: m.role,
					joinedAtMs: m.joinedAtMs,
					memberCount: memberCounts.get(m.leagueId) ?? 1
				});
			} catch {
				// Defensive skip on decode failure.
			}
		}
	}

	return hydrated.sort((a, b) => b.joinedAtMs - a.joinedAtMs);
};

/**
 * Return every membership row for a league. The doc key prefix is
 * `${leagueId}/` (per `leagueMemberKey`) so the scan filters on
 * that.
 *
 * Sorted by `joinedAtMs` ascending so the league's roster reads
 * "earliest joiner first" — the league-detail member panel ordering.
 */
export const listLeagueMembersFn = ({ leagueId }: { leagueId: string }): LeagueMemberDoc[] => {
	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.LEAGUE_MEMBERS,
		caller: caller.toUint8Array(),
		params: {}
	});

	const prefix = `${leagueId}/`;
	const members: LeagueMemberDoc[] = [];

	for (const [key, item] of items) {
		if (key.startsWith(prefix)) {
			try {
				const member = decodeDocData<LeagueMemberDoc>(item.data);

				// Belt-and-braces: only accept rows whose embedded
				// `leagueId` matches the prefix, in case a future key
				// shape change drifts.
				if (member.leagueId === leagueId) {
					members.push(member);
				}
			} catch {
				// skip malformed
			}
		}
	}

	return members.sort((a, b) => a.joinedAtMs - b.joinedAtMs);
};

/**
 * List battles that reference a specific league — either as sideA or
 * sideB. Used by the league detail page's "Battles" panel to render
 * proposed / accepted / in-flight / resolved competitions involving
 * this cohort.
 *
 * Sorted by `kickoffMs` ascending so in-flight battles surface before
 * future ones, then proposed/accepted in chronological order.
 */
export const listLeagueBattlesFn = ({ leagueId }: { leagueId: string }): BattleDoc[] => {
	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.BATTLES,
		caller: caller.toUint8Array(),
		params: {}
	});

	const battles: BattleDoc[] = [];

	for (const [, item] of items) {
		try {
			const battle = decodeDocData<BattleDoc>(item.data);

			if (battle.kind === 'league' && (battle.sideA === leagueId || battle.sideB === leagueId)) {
				battles.push(battle);
			}
		} catch {
			// skip malformed
		}
	}

	return battles.sort((a, b) => a.kickoffMs - b.kickoffMs);
};

/**
 * List every battle that involves the caller — either as a duel
 * principal (sideA / sideB on kind='duel') OR as the owner of a
 * league participating in a kind='league' battle.
 *
 * League-side resolution is N+1: each kind='league' battle triggers a
 * `getDocStore` lookup against `LEAGUES` to check ownership. Fine for
 * the battle volumes we expect on the social surface; a reverse
 * index would only matter past ~100s of battles per user.
 *
 * Sorted by `kickoffMs` ascending.
 */
export const listMyBattlesFn = (): BattleDoc[] => {
	const caller = msgCaller();
	const callerText = caller.toText();
	const callerBytes = caller.toUint8Array();

	const { items } = listDocsStore({
		collection: Collection.BATTLES,
		caller: callerBytes,
		params: {}
	});

	const isLeagueOwnedByCaller = (leagueId: string): boolean => {
		const leagueDoc = getDocStore({
			collection: Collection.LEAGUES,
			key: leagueId,
			caller: callerBytes
		});

		if (isNullish(leagueDoc)) {
			return false;
		}

		try {
			return decodeDocData<LeagueDoc>(leagueDoc.data).owner === callerText;
		} catch {
			return false;
		}
	};

	const battles: BattleDoc[] = [];

	for (const [, item] of items) {
		try {
			const battle = decodeDocData<BattleDoc>(item.data);

			const involvesCaller =
				battle.kind === 'duel'
					? battle.sideA === callerText || battle.sideB === callerText
					: isLeagueOwnedByCaller(battle.sideA) || isLeagueOwnedByCaller(battle.sideB);

			if (involvesCaller) {
				battles.push(battle);
			}
		} catch {
			// skip malformed
		}
	}

	return battles.sort((a, b) => a.kickoffMs - b.kickoffMs);
};

/**
 * Look up a league by its 6-char invite code — the read backing
 * the join-by-code FE flow. Scans the LEAGUES collection (small —
 * one row per league, bounded by user creation rate) and returns
 * the first match.
 *
 * Returns `undefined` when no league carries the code. Callers
 * should treat that as "invalid code" UX, not an error.
 *
 * Invite codes are write-once (per `assertSetLeague`), so the
 * `leagueId → inviteCode` mapping is stable for the lifetime of
 * the league. A future optimisation could maintain a reverse-index
 * collection if league count grows past the cost of a scan; until
 * then this is the canonical join-by-code resolver.
 */
export const lookupLeagueByInviteFn = ({
	inviteCode
}: {
	inviteCode: string;
}): LeagueDoc | undefined => {
	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.LEAGUES,
		caller: caller.toUint8Array(),
		params: {}
	});

	for (const [, item] of items) {
		try {
			const league = decodeDocData<LeagueDoc>(item.data);

			if (league.inviteCode === inviteCode) {
				return league;
			}
		} catch {
			// skip malformed
		}
	}
};

/**
 * List the leagues the caller can challenge to a battle — the opponent
 * pool for the create-battle picker.
 *
 * Challengeable = every **publicly listed** (Open) league plus every
 * league the caller is a member of (so invite-only / private leagues the
 * caller belongs to are reachable too), **minus** any league the caller
 * owns — those are the from-side of a challenge, never the opponent.
 *
 * Privacy mirrors the rest of the social surface: invite-only and private
 * leagues the caller is NOT a member of stay hidden (they're reachable by
 * invite code, not by browsing the opponent pool). The membership scan
 * resolves "am I in this league?" the same way {@link listMyLeaguesFn}
 * does.
 *
 * Sorted by `name` ascending (locale-naive) so the FE picker reads
 * alphabetically before any client-side search filter narrows it.
 */
export const listChallengeableLeaguesFn = (): LeagueDoc[] => {
	const caller = msgCaller();
	const callerText = caller.toText();
	const callerBytes = caller.toUint8Array();

	// Leagues the caller is a member of — lets invite-only / private
	// leagues the caller belongs to surface as opponents while non-members
	// can't see them.
	const myLeagueIds = new Set<string>();

	const { items: memberItems } = listDocsStore({
		collection: Collection.LEAGUE_MEMBERS,
		caller: callerBytes,
		params: {}
	});

	for (const [, item] of memberItems) {
		try {
			const member = decodeDocData<LeagueMemberDoc>(item.data);

			if (member.member === callerText) {
				myLeagueIds.add(member.leagueId);
			}
		} catch {
			// skip malformed
		}
	}

	const { items } = listDocsStore({
		collection: Collection.LEAGUES,
		caller: callerBytes,
		params: {}
	});

	const challengeable: LeagueDoc[] = [];

	for (const [, item] of items) {
		try {
			const league = decodeDocData<LeagueDoc>(item.data);

			// Never offer a league the caller owns as the opponent — it's
			// the from-side of any challenge they send.
			const ownedByCaller = league.owner === callerText;
			const isPubliclyListed = isLeaguePubliclyListed(league);
			const isMember = myLeagueIds.has(league.id);

			if (!ownedByCaller && (isPubliclyListed || isMember)) {
				challengeable.push(league);
			}
		} catch {
			// skip malformed
		}
	}

	return challengeable.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
};

/**
 * A non-private (Open or Invite-only) league a friend is in but the
 * caller is not — plus the overlap.
 */
export interface FriendRecommendedLeague {
	league: LeagueDoc;
	/** Total members in the league (owner included). */
	memberCount: number;
	/**
	 * Principals of the caller's friends who are members of this league.
	 * Drives the stacked-avatar cluster + "N friends here" count on the
	 * recommendation card.
	 */
	friendMembers: string[];
}

/**
 * Recommend leagues the caller's **friends** are in but the caller is
 * **not** — the "Friends are in" row at the foot of the Leagues list.
 *
 * Definition of "friend": a confirmed, bilateral friendship — a
 * `RELATIONS` doc with `category === FRIEND`, `state === ACTIVE`, and
 * the caller among its participants. The same definition
 * {@link listFriends} (relation.services) uses. One-way follows are
 * intentionally NOT treated as friends here: a follow is asymmetric and
 * does not imply the followed user consented to a relationship, so
 * surfacing "leagues that someone you follow is in" would leak that
 * user's league membership to an account they never opted into.
 *
 * Privacy scope: Open **and** Invite-only leagues a friend is in are
 * recommended — an invite-only league is a code gate, not secrecy, and a
 * friend already in it is the natural inviter, so a "friends are in" nudge
 * is appropriate. Only **Private** leagues are withheld: they stay hidden
 * and invite-code-only, never surfaced via a friend. Membership itself is
 * only ever exposed for the caller's own confirmed friends (never for
 * strangers), so the surface answers "which Open/Invite-only leagues are
 * my friends in?" and nothing broader.
 *
 * Cost: one scan of `RELATIONS` (friend set), one scan of
 * `LEAGUE_MEMBERS` (member buckets + the caller's own leagues + member
 * tallies), then a `getDocStore` per candidate league to read its
 * privacy + metadata. Candidate count is bounded by the number of
 * distinct leagues the caller's friends belong to.
 *
 * Sorted by friend-overlap count descending (most friends first), then
 * by league name ascending for a deterministic tie-break.
 */
export const listFriendRecommendedLeaguesFn = (): FriendRecommendedLeague[] => {
	const caller = msgCaller();
	const callerText = caller.toText();
	const callerBytes = caller.toUint8Array();

	// ── Friend set: confirmed bilateral friendships involving the caller.
	const { items: relationItems } = listDocsStore({
		collection: Collection.RELATIONS,
		caller: callerBytes,
		params: {}
	});

	const friendPrincipals = new Set<string>();

	for (const [, item] of relationItems) {
		try {
			const relation = decodeDocData<Relation>(item.data);

			if (
				relation.category === RelationCategory.FRIEND &&
				relation.state === RelationState.ACTIVE &&
				relation.participants.includes(callerText)
			) {
				const other = relation.participants.find((p) => p !== callerText);

				if (nonNullish(other)) {
					friendPrincipals.add(other);
				}
			}
		} catch {
			// skip malformed
		}
	}

	// No friends ⇒ nothing to recommend; skip the membership scan.
	if (friendPrincipals.size === 0) {
		return [];
	}

	// ── Single pass over `league_members`: bucket friend members per
	// league, tally total members per league, and collect the caller's
	// own leagues (to exclude them).
	const { items: memberItems } = listDocsStore({
		collection: Collection.LEAGUE_MEMBERS,
		caller: callerBytes,
		params: {}
	});

	const myLeagueIds = new Set<string>();
	const memberCounts = new Map<string, number>();
	const friendsByLeague = new Map<string, Set<string>>();

	for (const [, item] of memberItems) {
		try {
			const member = decodeDocData<LeagueMemberDoc>(item.data);

			memberCounts.set(member.leagueId, (memberCounts.get(member.leagueId) ?? 0) + 1);

			if (member.member === callerText) {
				myLeagueIds.add(member.leagueId);
			} else if (friendPrincipals.has(member.member)) {
				const bucket = friendsByLeague.get(member.leagueId);

				if (nonNullish(bucket)) {
					bucket.add(member.member);
				} else {
					friendsByLeague.set(member.leagueId, new Set([member.member]));
				}
			}
		} catch {
			// skip malformed
		}
	}

	const recommendations: FriendRecommendedLeague[] = [];

	for (const [leagueId, friendSet] of friendsByLeague.entries()) {
		// A friend is in it, but the caller already is too ⇒ not a rec.
		const isRecommendable = !myLeagueIds.has(leagueId);

		if (isRecommendable) {
			const leagueDoc = getDocStore({
				collection: Collection.LEAGUES,
				key: leagueId,
				caller: callerBytes
			});

			// Skip orphaned membership rows whose parent league is gone,
			// mirroring `listMyLeaguesFn`'s tolerance of orphans.
			if (nonNullish(leagueDoc)) {
				try {
					const league = decodeDocData<LeagueDoc>(leagueDoc.data);

					// Never surface a Private league to a non-member, even via a
					// friend. Open and Invite-only both qualify (invite-only is a
					// code gate, not secrecy, and a friend is the natural inviter).
					if (isLeagueRecommendableToFriends(league)) {
						recommendations.push({
							league,
							memberCount: memberCounts.get(leagueId) ?? friendSet.size,
							// Sort for a stable order — the Set's insertion order
							// follows the LEAGUE_MEMBERS scan, which would make the
							// highlighted friend + stacked avatars non-deterministic.
							friendMembers: [...friendSet].sort()
						});
					}
				} catch {
					// skip malformed
				}
			}
		}
	}

	return recommendations.sort((a, b) => {
		if (a.friendMembers.length !== b.friendMembers.length) {
			return b.friendMembers.length - a.friendMembers.length;
		}

		return a.league.name < b.league.name ? -1 : a.league.name > b.league.name ? 1 : 0;
	});
};

/**
 * Caller's current Worlds affiliations — at most one university +
 * one country per user (the assert key shape allows one of each
 * kind simultaneously). Returns the pair as `{ university?, country? }`;
 * when both slots are empty the FE Worlds picker can offer them.
 *
 * Single-pass scan filtered to `member === callerText`; per
 * `AFFILIATION_LOCK_MS` semantics the rows are stable for 90 days
 * once written.
 *
 * Backwards-compat: rows written before the
 * `affiliationId` → `affiliationIdentifier` rename still live in
 * stable memory with the old field key. `decodeDocData` returns the
 * raw msgpack shape (the TS type is a compile-time assertion), so a
 * pre-rename doc decodes with `aff.affiliationIdentifier === undefined`
 * and `aff.affiliationId` populated. Reading both and dropping the
 * row when neither is present keeps `listMyAffiliations` from
 * trapping at the JsonData → Candid boundary (the inner Option
 * struct requires `affiliationIdentifier`).
 */
export const listMyAffiliationsFn = (): {
	university?: AffiliationDoc;
	country?: AffiliationDoc;
} => {
	const caller = msgCaller();
	const callerText = caller.toText();

	const { items } = listDocsStore({
		collection: Collection.AFFILIATIONS,
		caller: caller.toUint8Array(),
		params: {}
	});

	let university: AffiliationDoc | undefined;
	let country: AffiliationDoc | undefined;

	for (const [, item] of items) {
		try {
			const aff = readAffiliationDoc(item.data);

			if (nonNullish(aff) && aff.member === callerText) {
				if (aff.kind === 'university') {
					university = aff;
				} else if (aff.kind === 'country') {
					country = aff;
				}
			}
		} catch {
			// skip malformed
		}
	}

	return { university, country };
};

/**
 * Tolerant `AffiliationDoc` reader. Coerces the legacy
 * `affiliationId` field to `affiliationIdentifier` so pre-rename
 * rows decode cleanly, AND fully validates the remaining required
 * fields so every call site can rely on a well-formed shape.
 *
 * Returns `undefined` when any required field is missing or
 * structurally invalid:
 *
 *  - `affiliationIdentifier` (or legacy `affiliationId`) — non-empty string
 *  - `member` — non-empty string (a real principal-text check costs more
 *    than it's worth here; the write-time assert already enforced it)
 *  - `kind` — `'university' | 'country'`
 *  - `joinedAtMs` / `lockedUntilMs` — finite numbers (guards against
 *    `NaN` flowing into the Option-schema parse and into roster sort
 *    comparisons in `listWorldsRosterFn`)
 *
 * Callers skip the row rather than emit a malformed wire shape that
 * would trap the `j.optional(AffiliationWireSchema)` parse or
 * the JsonData → Candid conversion.
 */
export const readAffiliationDoc = (data: Uint8Array): AffiliationDoc | undefined => {
	const raw = decodeDocData<AffiliationDoc & { affiliationId?: string }>(data);
	const identifier = raw.affiliationIdentifier ?? raw.affiliationId;

	if (typeof identifier !== 'string' || identifier.length === 0) {
		return;
	}

	if (typeof raw.member !== 'string' || raw.member.length === 0) {
		return;
	}

	if (raw.kind !== 'university' && raw.kind !== 'country') {
		return;
	}

	if (typeof raw.joinedAtMs !== 'number' || !Number.isFinite(raw.joinedAtMs)) {
		return;
	}

	if (typeof raw.lockedUntilMs !== 'number' || !Number.isFinite(raw.lockedUntilMs)) {
		return;
	}

	return {
		member: raw.member,
		kind: raw.kind,
		affiliationIdentifier: identifier,
		joinedAtMs: raw.joinedAtMs,
		lockedUntilMs: raw.lockedUntilMs
	};
};

/**
 * Roster scan for a Worlds slot — every user affiliated with a given
 * university or country. Drives the Worlds leaderboard / cohort
 * summary surface.
 *
 * Scans the full `affiliations` collection and filters on the
 * embedded `kind` + `affiliationIdentifier`. Sorted by `joinedAtMs`
 * ascending so the leaderboard reads "earliest joiner first" before
 * any accuracy-based re-sort the FE layers on top.
 */
export const listWorldsRosterFn = ({
	kind,
	affiliationIdentifier
}: {
	kind: AffiliationKind;
	affiliationIdentifier: string;
}): AffiliationDoc[] => {
	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.AFFILIATIONS,
		caller: caller.toUint8Array(),
		params: {}
	});

	const roster: AffiliationDoc[] = [];

	for (const [, item] of items) {
		try {
			const aff = readAffiliationDoc(item.data);

			if (
				nonNullish(aff) &&
				aff.kind === kind &&
				aff.affiliationIdentifier === affiliationIdentifier
			) {
				roster.push(aff);
			}
		} catch {
			// skip malformed
		}
	}

	return roster.sort((a, b) => a.joinedAtMs - b.joinedAtMs);
};

/** A single affiliation's real member tally for a Worlds kind. */
export interface AffiliationMemberCount {
	affiliationIdentifier: string;
	kind: AffiliationKind;
	memberCount: number;
}

/**
 * Member-count aggregate for every affiliation of a Worlds kind.
 * One pass over the `affiliations` collection, bucketed by
 * `affiliationIdentifier`. Returns a real count (number of users who
 * hold that university / country slot) — the same source of truth as
 * `listWorldsRosterFn`, but tallied to a scalar so a caller that only
 * needs "N members" (the picker, a detail-page chip) doesn't have to
 * page the full roster payload per affiliation.
 *
 * Affiliations with no members simply don't appear in the result —
 * callers treat a missing entry as zero / "no members yet".
 */
export const listWorldsMemberCountsFn = ({
	kind
}: {
	kind: AffiliationKind;
}): AffiliationMemberCount[] => {
	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.AFFILIATIONS,
		caller: caller.toUint8Array(),
		params: {}
	});

	const counts = new Map<string, number>();

	for (const [, item] of items) {
		try {
			const aff = readAffiliationDoc(item.data);

			if (nonNullish(aff) && aff.kind === kind) {
				counts.set(aff.affiliationIdentifier, (counts.get(aff.affiliationIdentifier) ?? 0) + 1);
			}
		} catch {
			// skip malformed
		}
	}

	return [...counts.entries()]
		.map(([affiliationIdentifier, memberCount]) => ({ affiliationIdentifier, kind, memberCount }))
		.sort((a, b) =>
			b.memberCount !== a.memberCount
				? b.memberCount - a.memberCount
				: a.affiliationIdentifier < b.affiliationIdentifier
					? -1
					: a.affiliationIdentifier > b.affiliationIdentifier
						? 1
						: 0
		);
};

/** A past month an affiliation topped its kind — one champion cup. */
export interface AffiliationChampionship {
	/** YYYY-MM of the closed month the affiliation finished first. */
	monthAnchor: string;
	/** Frozen month accuracy at the time of the win (0..1). */
	accuracy: number;
	/** Resolved calls in that month — the depth behind the accuracy. */
	monthTotalCalls: number;
}

/**
 * Champion history for a single affiliation — every past month in
 * which it finished **first** in its kind's monthly ranking.
 *
 * This reads the frozen `affiliation_stats` snapshot docs (3-segment
 * keys, written by the lazy month-rollover in
 * `affiliation-stats.services.ts`). For each closed month present in
 * the snapshots, the top-ranked affiliation — by the same sort the
 * podium fan-out uses (`listAffiliationStatsForMonthFn`) — is that
 * month's champion. We collect the months where the requested
 * affiliation held that top slot.
 *
 * There is no separate "season conclusion" or champion-recording
 * entity in the backend: the only thing that closes a Worlds window
 * is this per-doc monthly rollover (Juno exposes no scheduler
 * primitive, so there's nothing that ends a season and stamps a
 * winner). History therefore populates one entry per month that has
 * actually rolled over and had a ranked leader — empty until the
 * first month closes.
 *
 * Cost: O(snapshots) scan + a group-by; the per-month winner is the
 * first element of each month's sorted bucket.
 */
export const listAffiliationChampionshipsFn = ({
	kind,
	affiliationIdentifier
}: {
	kind: AffiliationKind;
	affiliationIdentifier: string;
}): AffiliationChampionship[] => {
	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.AFFILIATION_STATS,
		caller: caller.toUint8Array(),
		params: {}
	});

	// Group every qualifying snapshot doc by its month so we can pick a
	// single winner per closed month.
	const byMonth = new Map<string, AffiliationStatsDoc[]>();

	for (const [docKey, item] of items) {
		// Cheap pre-filter: snapshot keys carry an extra segment, so they
		// have more than one slash. The precise test (key ends in
		// `/${monthAnchor}`) needs the decoded doc, so it runs below —
		// this only skips obvious non-snapshot keys before decoding.
		const hasExtraSegment = docKey.indexOf('/') !== docKey.lastIndexOf('/');

		if (hasExtraSegment) {
			try {
				const doc = decodeDocData<AffiliationStatsDoc>(item.data);

				// Snapshot docs only — the key must end in `/${monthAnchor}`
				// (same precise test as `listAffiliationStatsForMonthFn`), so
				// non-snapshot keys that merely have extra slashes aren't
				// misread as snapshots.
				const isSnapshot = docKey.endsWith(`/${doc.monthAnchor}`);

				if (isSnapshot && doc.kind === kind && doc.monthTotalCalls >= MIN_CALLS_FOR_RANK) {
					const bucket = byMonth.get(doc.monthAnchor);

					if (nonNullish(bucket)) {
						bucket.push(doc);
					} else {
						byMonth.set(doc.monthAnchor, [doc]);
					}
				}
			} catch {
				// skip malformed
			}
		}
	}

	const championships: AffiliationChampionship[] = [];

	for (const [monthAnchor, bucket] of byMonth.entries()) {
		// Same tie-break as the podium / leaderboard: accuracy desc →
		// monthTotalCalls desc → affiliationIdentifier asc.
		bucket.sort(
			compareAffiliationRank({
				accuracyOf: (doc) => doc.monthWins / doc.monthTotalCalls,
				callsOf: (doc) => doc.monthTotalCalls
			})
		);

		const [winner] = bucket;

		if (nonNullish(winner) && winner.affiliationIdentifier === affiliationIdentifier) {
			championships.push({
				monthAnchor,
				accuracy: winner.monthWins / winner.monthTotalCalls,
				monthTotalCalls: winner.monthTotalCalls
			});
		}
	}

	// Most recent cup first.
	return championships.sort((a, b) =>
		a.monthAnchor < b.monthAnchor ? 1 : a.monthAnchor > b.monthAnchor ? -1 : 0
	);
};

/**
 * Single-doc lookup for `affiliation_stats`. Returns `undefined`
 * when no stats doc exists yet (the affiliation hasn't been the
 * subject of any settled call). Callers should treat that as
 * "unranked / no data" rather than as an error.
 */
export const getAffiliationStatsFn = ({
	kind,
	affiliationIdentifier
}: {
	kind: AffiliationKind;
	affiliationIdentifier: string;
}): AffiliationStatsDoc | undefined => {
	const caller = msgCaller();
	const key = affiliationStatsKey({ kind, affiliationIdentifier });
	const doc = getDocStore({
		collection: Collection.AFFILIATION_STATS,
		key,
		caller: caller.toUint8Array()
	});

	if (isNullish(doc)) {
		return;
	}

	try {
		return decodeDocData<AffiliationStatsDoc>(doc.data);
	} catch {
		// Malformed payload — treat as "no stats" for callers.
	}
};

/**
 * Ranked leaderboard scan for a Worlds kind. Returns every stats
 * doc for the requested kind, sorted by accuracy descending.
 * Affiliations below `MIN_CALLS_FOR_RANK` are filtered out — at
 * tiny call counts the accuracy is too noisy to rank.
 *
 * Sort key: `wins / totalCalls` desc, then `totalCalls` desc
 * (rewards depth), then `affiliationIdentifier` asc (deterministic tie
 * break across re-runs — same rule the Worlds podium fan-out
 * uses, so the leaderboard and the awards agree).
 */
export const listAffiliationStatsFn = ({
	kind,
	limit
}: {
	kind: AffiliationKind;
	limit?: number;
}): AffiliationStatsDoc[] => {
	const caller = msgCaller();
	const { items } = listDocsStore({
		collection: Collection.AFFILIATION_STATS,
		caller: caller.toUint8Array(),
		params: {}
	});

	const stats: AffiliationStatsDoc[] = [];

	for (const [docKey, item] of items) {
		// Filter out snapshot docs (3-segment keys) — only rolling
		// (current-month) docs participate in the live leaderboard.
		// Counting slashes is cheaper than splitting; we just need >1.
		const isRollingDoc = docKey.indexOf('/') === docKey.lastIndexOf('/');

		if (isRollingDoc) {
			try {
				const doc = decodeDocData<AffiliationStatsDoc>(item.data);

				if (doc.kind === kind && doc.totalCalls >= MIN_CALLS_FOR_RANK) {
					stats.push(doc);
				}
			} catch {
				// skip malformed
			}
		}
	}

	stats.sort(
		compareAffiliationRank({
			accuracyOf: (doc) => doc.wins / doc.totalCalls,
			callsOf: (doc) => doc.totalCalls
		})
	);

	if (nonNullish(limit) && limit > 0) {
		return stats.slice(0, limit);
	}

	return stats;
};

/**
 * List the frozen snapshot docs for a specific completed month.
 * Returns affiliation stats for `(kind, *, monthAnchor)` — one row
 * per affiliation that had any activity in that month.
 *
 * Drives the Worlds podium monthly fan-out: pick the top-3 here and
 * credit VXP to every member of each. Sort key is the same as
 * `listAffiliationStatsFn` so the leaderboard view and the awards
 * agree.
 */
export const listAffiliationStatsForMonthFn = ({
	kind,
	monthAnchor
}: {
	kind: AffiliationKind;
	monthAnchor: string;
}): AffiliationStatsDoc[] => {
	const caller = msgCaller();
	const { items } = listDocsStore({
		collection: Collection.AFFILIATION_STATS,
		caller: caller.toUint8Array(),
		params: {}
	});

	const expectedSuffix = `/${monthAnchor}`;
	const stats: AffiliationStatsDoc[] = [];

	for (const [docKey, item] of items) {
		// Only 3-segment keys ending in `/${monthAnchor}` qualify — these
		// are the frozen snapshots written at the moment the month
		// rolled over.
		const isSnapshotForMonth =
			docKey.indexOf('/') !== docKey.lastIndexOf('/') && docKey.endsWith(expectedSuffix);

		if (isSnapshotForMonth) {
			try {
				const doc = decodeDocData<AffiliationStatsDoc>(item.data);

				if (
					doc.kind === kind &&
					doc.monthAnchor === monthAnchor &&
					doc.monthTotalCalls >= MIN_CALLS_FOR_RANK
				) {
					stats.push(doc);
				}
			} catch {
				// skip malformed
			}
		}
	}

	stats.sort(
		compareAffiliationRank({
			accuracyOf: (doc) => doc.monthWins / doc.monthTotalCalls,
			callsOf: (doc) => doc.monthTotalCalls
		})
	);

	return stats;
};
