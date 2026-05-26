import { Collection } from '$lib/constants/collections.constants';
import type { LeagueDoc } from '$lib/types/league';
import type { LeagueMemberDoc } from '$lib/types/league-member';
import {
	matchCountForRound,
	monthAnchorFromMs,
	roundWindow,
	TOURNAMENT_BRACKET_SIZE,
	TOURNAMENT_ROUND_DURATION_MS,
	TOURNAMENT_ROUNDS,
	tournamentMatchKey,
	type TournamentDoc,
	type TournamentMatchDoc
} from '$lib/types/tournament';
import { isNullish, nonNullish } from '@dfinity/utils';
import type { AssertSetDocContext } from '@junobuild/functions';
import { msgCaller, time } from '@junobuild/functions/ic-cdk';
import {
	decodeDocData,
	encodeDocData,
	getDocStore,
	listDocsStore,
	setDocStore
} from '@junobuild/functions/sdk';

/**
 * Monthly tournament — Proposal 3 in `docs/backend-proposals/README.md`.
 *
 * **What's shipped here:**
 *  - Asserts for both collections (key shape, write-once invariants,
 *    forward-only state).
 *  - `triggerTournamentDrawFn` — anyone can call; idempotent via
 *    doc-key collision on the month anchor. Scans LEAGUE_MEMBERS,
 *    counts members per league, seeds the top-16 into Round 1.
 *  - `getCurrentTournamentFn` — returns the latest tournament + its
 *    matches for the FE.
 *
 * **What's deferred (documented as Proposal 3 follow-ups):**
 *  - Round resolution: computing per-league accuracy in the round
 *    window requires a per-window aggregation pipeline that doesn't
 *    exist yet. Once `AFFILIATION_STATS` gains a leagues counterpart
 *    (LEAGUE_STATS — same shape, prefix-keyed by leagueId), the
 *    resolution can read each league's `monthWins / monthTotalCalls`
 *    for the round window and pick the winner.
 *  - Prize claim: a user-claim variant of the same pattern as
 *    Worlds podium (`VXP_AWARDS` key + ledger transfer), gated by
 *    membership in the winning league at tournament close.
 *
 * Forfeit rule (decision 3.4): when round-resolution lands, a league
 * with fewer than 50 calls in the window forfeits. If both sides
 * forfeit, the lower-seed advances — keeps the bracket deterministic
 * without needing a coin-flip RNG in the satellite.
 */

const ASSERT_PREFIX = 'tournament';

/**
 * Single-doc-per-month assert. Key must equal `${id}` and match
 * `monthAnchorFromMs(monthStartMs)`. `bracketSize` and
 * `seededLeagueIds` are immutable after the initial write; the only
 * field that ever mutates is `state` (in_flight → concluded).
 */
export const assertSetTournament = ({
	data: {
		collection,
		key,
		data: { current, proposed }
	}
}: AssertSetDocContext): void => {
	if (collection !== Collection.TOURNAMENTS) {
		return;
	}

	const proposedDoc = decodeDocData<TournamentDoc>(proposed.data);

	if (key !== proposedDoc.id) {
		throw new Error(
			`${ASSERT_PREFIX}: doc key "${key}" must match embedded id "${proposedDoc.id}".`
		);
	}

	if (!/^\d{4}-\d{2}$/.test(proposedDoc.id)) {
		throw new Error(
			`${ASSERT_PREFIX}: id must be a YYYY-MM month anchor, got "${proposedDoc.id}".`
		);
	}

	if (monthAnchorFromMs(proposedDoc.monthStartMs) !== proposedDoc.id) {
		throw new Error(`${ASSERT_PREFIX}: monthStartMs disagrees with id "${proposedDoc.id}".`);
	}

	if (proposedDoc.bracketSize !== TOURNAMENT_BRACKET_SIZE) {
		throw new Error(
			`${ASSERT_PREFIX}: bracketSize must be ${TOURNAMENT_BRACKET_SIZE}, got ${proposedDoc.bracketSize}.`
		);
	}

	if (proposedDoc.seededLeagueIds.length !== TOURNAMENT_BRACKET_SIZE) {
		throw new Error(
			`${ASSERT_PREFIX}: seededLeagueIds must have length ${TOURNAMENT_BRACKET_SIZE}, got ${proposedDoc.seededLeagueIds.length}.`
		);
	}

	if (isNullish(current)) {
		if (proposedDoc.state !== 'in_flight') {
			throw new Error(`${ASSERT_PREFIX}: new tournaments must start in "in_flight" state.`);
		}

		return;
	}

	const currentDoc = decodeDocData<TournamentDoc>(current.data);

	if (
		currentDoc.id !== proposedDoc.id ||
		currentDoc.monthStartMs !== proposedDoc.monthStartMs ||
		currentDoc.monthEndMs !== proposedDoc.monthEndMs ||
		currentDoc.bracketSize !== proposedDoc.bracketSize ||
		currentDoc.createdAtMs !== proposedDoc.createdAtMs ||
		JSON.stringify(currentDoc.seededLeagueIds) !== JSON.stringify(proposedDoc.seededLeagueIds)
	) {
		throw new Error(
			`${ASSERT_PREFIX}: id / monthStartMs / monthEndMs / bracketSize / createdAtMs / seededLeagueIds are immutable.`
		);
	}

	if (currentDoc.state === 'concluded') {
		throw new Error(`${ASSERT_PREFIX}: doc is terminal (state="concluded"); no further writes.`);
	}

	if (proposedDoc.state !== 'concluded') {
		throw new Error(`${ASSERT_PREFIX}: state may only transition in_flight → concluded.`);
	}
};

/**
 * Per-match assert. Key must equal
 * `${tournamentId}/${round}/${index}` and agree with the embedded
 * fields. `fromLeagueId` / `toLeagueId` / `startMs` / `endMs` are
 * immutable; accuracy + winner are write-once (null → number).
 */
export const assertSetTournamentMatch = ({
	data: {
		collection,
		key,
		data: { current, proposed }
	}
}: AssertSetDocContext): void => {
	if (collection !== Collection.TOURNAMENT_MATCHES) {
		return;
	}

	const proposedDoc = decodeDocData<TournamentMatchDoc>(proposed.data);
	const expectedKey = tournamentMatchKey({
		tournamentId: proposedDoc.tournamentId,
		round: proposedDoc.round,
		index: proposedDoc.index
	});

	if (key !== expectedKey) {
		throw new Error(
			`${ASSERT_PREFIX}_match: key "${key}" must equal "${expectedKey}" (tournamentId/round/index drift).`
		);
	}

	if (!TOURNAMENT_ROUNDS.includes(proposedDoc.round)) {
		throw new Error(`${ASSERT_PREFIX}_match: round "${proposedDoc.round}" is not a valid round.`);
	}

	const expectedMatchCount = matchCountForRound(proposedDoc.round);

	if (proposedDoc.index < 0 || proposedDoc.index >= expectedMatchCount) {
		throw new Error(
			`${ASSERT_PREFIX}_match: index ${proposedDoc.index} out of range for ${proposedDoc.round} (0..${expectedMatchCount - 1}).`
		);
	}

	if (proposedDoc.endMs <= proposedDoc.startMs) {
		throw new Error(`${ASSERT_PREFIX}_match: endMs must be greater than startMs.`);
	}

	if (isNullish(current)) {
		return;
	}

	const currentDoc = decodeDocData<TournamentMatchDoc>(current.data);

	if (
		currentDoc.tournamentId !== proposedDoc.tournamentId ||
		currentDoc.round !== proposedDoc.round ||
		currentDoc.index !== proposedDoc.index ||
		currentDoc.startMs !== proposedDoc.startMs ||
		currentDoc.endMs !== proposedDoc.endMs
	) {
		throw new Error(
			`${ASSERT_PREFIX}_match: tournamentId / round / index / startMs / endMs are immutable.`
		);
	}

	// `fromLeagueId` / `toLeagueId` are write-once: null → string allowed
	// (the round-resolution job fills them in when the previous round
	// settles), but a non-null value can never change.
	if (nonNullish(currentDoc.fromLeagueId) && currentDoc.fromLeagueId !== proposedDoc.fromLeagueId) {
		throw new Error(`${ASSERT_PREFIX}_match: fromLeagueId is immutable once set.`);
	}

	if (nonNullish(currentDoc.toLeagueId) && currentDoc.toLeagueId !== proposedDoc.toLeagueId) {
		throw new Error(`${ASSERT_PREFIX}_match: toLeagueId is immutable once set.`);
	}

	if (nonNullish(currentDoc.fromAcc) && currentDoc.fromAcc !== proposedDoc.fromAcc) {
		throw new Error(`${ASSERT_PREFIX}_match: fromAcc is write-once.`);
	}

	if (nonNullish(currentDoc.toAcc) && currentDoc.toAcc !== proposedDoc.toAcc) {
		throw new Error(`${ASSERT_PREFIX}_match: toAcc is write-once.`);
	}

	if (
		nonNullish(currentDoc.winnerLeagueId) &&
		currentDoc.winnerLeagueId !== proposedDoc.winnerLeagueId
	) {
		throw new Error(`${ASSERT_PREFIX}_match: winnerLeagueId is write-once.`);
	}
};

/**
 * Count active members per league by scanning LEAGUE_MEMBERS. Returns
 * a `[leagueId, memberCount]` array sorted by count desc; ties
 * broken by leagueId asc so the seeding is deterministic.
 *
 * Heavy scan, but the satellite has no compound index — and a
 * draw runs at most once per month, so the cost is acceptable.
 */
const countMembersPerLeague = (callerBytes: Uint8Array): Array<[string, number]> => {
	const { items } = listDocsStore({
		collection: Collection.LEAGUE_MEMBERS,
		caller: callerBytes,
		params: {}
	});

	const counts = new Map<string, number>();

	for (const [, item] of items) {
		try {
			const member = decodeDocData<LeagueMemberDoc>(item.data);
			counts.set(member.leagueId, (counts.get(member.leagueId) ?? 0) + 1);
		} catch {
			// skip malformed
		}
	}

	return Array.from(counts.entries()).sort(([aId, aCount], [bId, bCount]) => {
		if (aCount !== bCount) {
			return bCount - aCount;
		}

		return aId < bId ? -1 : aId > bId ? 1 : 0;
	});
};

/**
 * Standard single-elimination seeding: seed 1 plays seed 16, seed 2
 * plays seed 15, etc. Returns the pair list for Round 1 in match
 * order (8 pairs total).
 */
const seedFirstRoundPairs = (
	seededLeagueIds: string[]
): Array<{ fromLeagueId: string; toLeagueId: string }> => {
	const pairs: Array<{ fromLeagueId: string; toLeagueId: string }> = [];
	const n = seededLeagueIds.length;

	for (let i = 0; i < n / 2; i += 1) {
		pairs.push({
			fromLeagueId: seededLeagueIds[i],
			toLeagueId: seededLeagueIds[n - 1 - i]
		});
	}

	return pairs;
};

export type TriggerTournamentDrawRefusalReason =
	| 'already_drawn'
	| 'month_not_started'
	| 'insufficient_leagues'
	| 'invalid_input';

export interface TriggerTournamentDrawResult {
	ok: boolean;
	tournamentId?: string;
	reason?: TriggerTournamentDrawRefusalReason;
	availableLeagues?: number;
}

/**
 * Run the monthly draw for `monthAnchor`. Anyone can call (the
 * doc-key collision makes the draw idempotent — a second call for
 * the same month returns `already_drawn` cleanly), so the FE can
 * fire-and-forget on every Tournament-page mount.
 *
 * Refuses if fewer than `TOURNAMENT_BRACKET_SIZE` leagues exist —
 * the data set is too small to seed a full bracket. The FE surfaces
 * this as a "waiting on more leagues" hint.
 */
export const triggerTournamentDrawFn = ({
	monthAnchor
}: {
	monthAnchor: string;
}): TriggerTournamentDrawResult => {
	if (!/^\d{4}-\d{2}$/.test(monthAnchor)) {
		return { ok: false, reason: 'invalid_input' };
	}

	const caller = msgCaller();
	const callerBytes = caller.toUint8Array();

	// Idempotency — collide on doc key for the same month.
	const existing = getDocStore({
		collection: Collection.TOURNAMENTS,
		key: monthAnchor,
		caller: callerBytes
	});

	if (nonNullish(existing)) {
		return { ok: false, reason: 'already_drawn', tournamentId: monthAnchor };
	}

	// Compute the month's window. The draw can be triggered for any
	// month that has *started*; the prototype's lazy-on-mount pattern
	// would trigger the draw on the first day of a new month.
	const nowMs = Number(time() / 1_000_000n);
	const [year, monthStr] = monthAnchor.split('-');
	const monthDate = new Date(Date.UTC(Number(year), Number(monthStr) - 1, 1, 0, 0, 0, 0));
	const startMs = monthDate.getTime();

	if (startMs > nowMs) {
		return { ok: false, reason: 'month_not_started' };
	}

	const ranking = countMembersPerLeague(callerBytes);

	if (ranking.length < TOURNAMENT_BRACKET_SIZE) {
		return {
			ok: false,
			reason: 'insufficient_leagues',
			availableLeagues: ranking.length
		};
	}

	const seededLeagueIds = ranking.slice(0, TOURNAMENT_BRACKET_SIZE).map(([id]) => id);

	// Defensive: belt-and-braces verify the league docs still exist for
	// each seeded id. A league that drained between the member scan and
	// here would still be eligible by member-count, but we skip it.
	const verifiedSeeded: string[] = [];

	for (const id of seededLeagueIds) {
		const league = getDocStore({
			collection: Collection.LEAGUES,
			key: id,
			caller: callerBytes
		});

		if (nonNullish(league)) {
			try {
				decodeDocData<LeagueDoc>(league.data);
				verifiedSeeded.push(id);
			} catch {
				// skip malformed
			}
		}
	}

	if (verifiedSeeded.length < TOURNAMENT_BRACKET_SIZE) {
		return {
			ok: false,
			reason: 'insufficient_leagues',
			availableLeagues: verifiedSeeded.length
		};
	}

	// Write the tournament doc first so the asserts on the match docs
	// have something to reference.
	const tournamentDoc: TournamentDoc = {
		id: monthAnchor,
		monthStartMs: startMs,
		monthEndMs: startMs + 4 * TOURNAMENT_ROUND_DURATION_MS,
		bracketSize: TOURNAMENT_BRACKET_SIZE,
		state: 'in_flight',
		seededLeagueIds: verifiedSeeded,
		createdAtMs: nowMs
	};

	setDocStore({
		collection: Collection.TOURNAMENTS,
		key: monthAnchor,
		caller: callerBytes,
		doc: {
			data: encodeDocData(tournamentDoc)
		}
	});

	// Write the 8 Round-1 matches with the seeded pairs.
	const r1Pairs = seedFirstRoundPairs(verifiedSeeded);
	const r1Window = roundWindow({ tournamentMonthStartMs: startMs, round: 'r1' });

	for (let index = 0; index < r1Pairs.length; index += 1) {
		const pair = r1Pairs[index];
		const matchDoc: TournamentMatchDoc = {
			tournamentId: monthAnchor,
			round: 'r1',
			index,
			fromLeagueId: pair.fromLeagueId,
			toLeagueId: pair.toLeagueId,
			fromAcc: null,
			toAcc: null,
			winnerLeagueId: null,
			startMs: r1Window.startMs,
			endMs: r1Window.endMs
		};

		setDocStore({
			collection: Collection.TOURNAMENT_MATCHES,
			key: tournamentMatchKey({ tournamentId: monthAnchor, round: 'r1', index }),
			caller: callerBytes,
			doc: {
				data: encodeDocData(matchDoc)
			}
		});
	}

	// Write the TBD-slot matches for quarter / semifinal / final so
	// the bracket UI can render the skeleton immediately. The fromLeagueId
	// / toLeagueId fields stay null until the round-resolution job
	// (not yet shipped) fills them in.
	for (const round of ['quarter', 'semifinal', 'final'] as const) {
		const window_ = roundWindow({ tournamentMonthStartMs: startMs, round });
		const count = matchCountForRound(round);

		for (let index = 0; index < count; index += 1) {
			const matchDoc: TournamentMatchDoc = {
				tournamentId: monthAnchor,
				round,
				index,
				fromLeagueId: null,
				toLeagueId: null,
				fromAcc: null,
				toAcc: null,
				winnerLeagueId: null,
				startMs: window_.startMs,
				endMs: window_.endMs
			};

			setDocStore({
				collection: Collection.TOURNAMENT_MATCHES,
				key: tournamentMatchKey({ tournamentId: monthAnchor, round, index }),
				caller: callerBytes,
				doc: {
					data: encodeDocData(matchDoc)
				}
			});
		}
	}

	return { ok: true, tournamentId: monthAnchor };
};

/**
 * Read the most recent tournament (highest YYYY-MM key) and its
 * matches. Returns `null` for the tournament when none has been
 * drawn yet — the FE renders the "no tournament yet" / draw CTA.
 */
export const getCurrentTournamentFn = (): {
	tournament: TournamentDoc | null;
	matches: TournamentMatchDoc[];
} => {
	const caller = msgCaller();
	const callerBytes = caller.toUint8Array();

	// Scan tournaments; pick the lexicographically-highest key (which
	// is also the latest month under the YYYY-MM convention).
	const { items: tournamentItems } = listDocsStore({
		collection: Collection.TOURNAMENTS,
		caller: callerBytes,
		params: {}
	});

	let latest: TournamentDoc | null = null;

	for (const [, item] of tournamentItems) {
		try {
			const doc = decodeDocData<TournamentDoc>(item.data);

			if (latest === null || doc.id > latest.id) {
				latest = doc;
			}
		} catch {
			// skip malformed
		}
	}

	if (latest === null) {
		return { tournament: null, matches: [] };
	}

	const { items: matchItems } = listDocsStore({
		collection: Collection.TOURNAMENT_MATCHES,
		caller: callerBytes,
		params: {}
	});

	const matches: TournamentMatchDoc[] = [];
	const prefix = `${latest.id}/`;

	for (const [docKey, item] of matchItems) {
		if (docKey.startsWith(prefix)) {
			try {
				const doc = decodeDocData<TournamentMatchDoc>(item.data);

				if (doc.tournamentId === latest.id) {
					matches.push(doc);
				}
			} catch {
				// skip malformed
			}
		}
	}

	// Sort by round (canonical order) then index for deterministic
	// FE rendering.
	matches.sort((a, b) => {
		const ra = TOURNAMENT_ROUNDS.indexOf(a.round);
		const rb = TOURNAMENT_ROUNDS.indexOf(b.round);

		if (ra !== rb) {
			return ra - rb;
		}

		return a.index - b.index;
	});

	return { tournament: latest, matches };
};

// Re-export for type narrowing in callers without re-importing
// `$lib/types/tournament`.
export type { TournamentDoc, TournamentMatchDoc };
