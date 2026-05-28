import { Collection } from '$lib/constants/collections.constants';
import type { AffiliationDoc, AffiliationKind } from '$lib/types/affiliation';
import {
	affiliationStatsKey,
	MIN_CALLS_FOR_RANK,
	type AffiliationStatsDoc
} from '$lib/types/affiliation-stats';
import type { BoutDoc } from '$lib/types/bout';
import type { LeagueDoc } from '$lib/types/league';
import type { LeagueMemberDoc } from '$lib/types/league-member';
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

/** Hydrated `LeagueDoc` paired with the caller's role inside it. */
export interface LeagueWithRole {
	league: LeagueDoc;
	role: LeagueMemberDoc['role'];
	joinedAtMs: number;
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

	for (const [, item] of items) {
		try {
			const member = decodeDocData<LeagueMemberDoc>(item.data);

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
				hydrated.push({ league, role: m.role, joinedAtMs: m.joinedAtMs });
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
 * List bouts that reference a specific league — either as sideA or
 * sideB. Used by the league detail page's "Bouts" panel to render
 * proposed / accepted / in-flight / resolved competitions involving
 * this cohort.
 *
 * Sorted by `kickoffMs` ascending so in-flight bouts surface before
 * future ones, then proposed/accepted in chronological order.
 */
export const listLeagueBoutsFn = ({ leagueId }: { leagueId: string }): BoutDoc[] => {
	const caller = msgCaller();

	const { items } = listDocsStore({
		collection: Collection.BOUTS,
		caller: caller.toUint8Array(),
		params: {}
	});

	const bouts: BoutDoc[] = [];

	for (const [, item] of items) {
		try {
			const bout = decodeDocData<BoutDoc>(item.data);

			if (bout.kind === 'league' && (bout.sideA === leagueId || bout.sideB === leagueId)) {
				bouts.push(bout);
			}
		} catch {
			// skip malformed
		}
	}

	return bouts.sort((a, b) => a.kickoffMs - b.kickoffMs);
};

/**
 * List every bout that involves the caller — either as a duel
 * principal (sideA / sideB on kind='duel') OR as the owner of a
 * league participating in a kind='league' bout.
 *
 * League-side resolution is N+1: each kind='league' bout triggers a
 * `getDocStore` lookup against `LEAGUES` to check ownership. Fine for
 * the bout volumes we expect on the social surface; a reverse
 * index would only matter past ~100s of bouts per user.
 *
 * Sorted by `kickoffMs` ascending.
 */
export const listMyBoutsFn = (): BoutDoc[] => {
	const caller = msgCaller();
	const callerText = caller.toText();
	const callerBytes = caller.toUint8Array();

	const { items } = listDocsStore({
		collection: Collection.BOUTS,
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

	const bouts: BoutDoc[] = [];

	for (const [, item] of items) {
		try {
			const bout = decodeDocData<BoutDoc>(item.data);

			const involvesCaller =
				bout.kind === 'duel'
					? bout.sideA === callerText || bout.sideB === callerText
					: isLeagueOwnedByCaller(bout.sideA) || isLeagueOwnedByCaller(bout.sideB);

			if (involvesCaller) {
				bouts.push(bout);
			}
		} catch {
			// skip malformed
		}
	}

	return bouts.sort((a, b) => a.kickoffMs - b.kickoffMs);
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
 * would trap the `j.optional(AffiliationOptionWireSchema)` parse or
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

	stats.sort((a, b) => {
		const aAcc = a.wins / a.totalCalls;
		const bAcc = b.wins / b.totalCalls;

		if (aAcc !== bAcc) {
			return bAcc - aAcc;
		}

		if (a.totalCalls !== b.totalCalls) {
			return b.totalCalls - a.totalCalls;
		}

		return a.affiliationIdentifier < b.affiliationIdentifier
			? -1
			: a.affiliationIdentifier > b.affiliationIdentifier
				? 1
				: 0;
	});

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

	stats.sort((a, b) => {
		const aAcc = a.monthWins / a.monthTotalCalls;
		const bAcc = b.monthWins / b.monthTotalCalls;

		if (aAcc !== bAcc) {
			return bAcc - aAcc;
		}

		if (a.monthTotalCalls !== b.monthTotalCalls) {
			return b.monthTotalCalls - a.monthTotalCalls;
		}

		return a.affiliationIdentifier < b.affiliationIdentifier
			? -1
			: a.affiliationIdentifier > b.affiliationIdentifier
				? 1
				: 0;
	});

	return stats;
};
