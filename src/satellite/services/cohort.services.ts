import { Collection } from '$lib/constants/collections.constants';
import type { BoutDoc } from '$lib/types/bout';
import type { LeagueDoc } from '$lib/types/league';
import type { LeagueMemberDoc } from '$lib/types/league-member';
import { isNullish, nonNullish } from '@dfinity/utils';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import { decodeDocData, getDocStore, listDocsStore } from '@junobuild/functions/sdk';

/**
 * Service-layer aggregation for the V1.2 social-cohort surface. Pure
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
 * "earliest joiner first" — matches V1.2's league-detail member
 * panel ordering.
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
 * the bout volumes we expect on the V1.2 social surface; a reverse
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
