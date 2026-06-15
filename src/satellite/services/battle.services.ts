import { Collection } from '$lib/constants/collections.constants';
import { LeaguePrivacy } from '$lib/enums/league';
import {
	BATTLE_KINDS,
	BATTLE_SCOPE_DEFAULT,
	BATTLE_SCOPES,
	BATTLE_STATES,
	BATTLE_TRANSITIONS,
	BATTLE_TRASH_TALK_MAX_LENGTH,
	BATTLE_WAGER_MAX,
	BATTLE_WAGER_MIN,
	battleAccuracyPct,
	deriveBattleWinner,
	type BattleDoc,
	type BattleScope,
	type BattleWinner
} from '$lib/types/battle';
import { leaguePrivacy, type LeagueDoc } from '$lib/types/league';
import { leagueMemberKey } from '$lib/types/league-member';
import { leagueStatsBucket, leagueStatsKey, type LeagueStatsDoc } from '$lib/types/league-stats';
import type { CategoryStatsBucket } from '$lib/types/user-stats';
import { isNullish, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import type { AssertDeleteDocContext, AssertSetDocContext } from '@junobuild/functions';
import { time } from '@junobuild/functions/ic-cdk';
import { decodeDocData, getDocStore } from '@junobuild/functions/sdk';

/** Window delta between a baseline snapshot and the current bucket, clamped `≥ 0`. */
const deltaBucket = (
	baseline: CategoryStatsBucket,
	current: CategoryStatsBucket
): CategoryStatsBucket => ({
	calls: Math.max(0, current.calls - baseline.calls),
	wins: Math.max(0, current.wins - baseline.wins)
});

const bucketsEqual = (a: CategoryStatsBucket, b: CategoryStatsBucket): boolean =>
	a.calls === b.calls && a.wins === b.wins;

const bucketsNullableEqual = (
	a: CategoryStatsBucket | undefined,
	b: CategoryStatsBucket | undefined
): boolean => {
	if (isNullish(a) || isNullish(b)) {
		return isNullish(a) && isNullish(b);
	}

	return bucketsEqual(a, b);
};

/**
 * Pre-write guard for `battles`. Enforces the time-bound competition
 * state machine, the per-state authorisation model, and — for league
 * battles — the trustless accuracy scoring.
 *
 *  1. **Key shape.** Doc key equals the embedded `id`.
 *
 *  2. **Identity fields immutable.** `id`, `kind`, `sideA`, `sideB`,
 *     `proposer`, `scope`, `wager`, `trashTalk` are write-once. The
 *     `baselineA` / `baselineB` snapshots are stamped at kickoff and
 *     frozen thereafter.
 *
 *  3. **State machine.** Forward-only per `BATTLE_TRANSITIONS`. New
 *     docs start at `proposed`. Each transition is gated by:
 *
 *       - `proposed`        — caller is the proposer (league.owner of
 *                             sideA for kind='league', or sideA
 *                             principal for kind='duel'). For league
 *                             battles sideB must be challengeable —
 *                             an OPEN league or one the proposer is a
 *                             member of.
 *       - `proposed → accepted` — caller is the *other* side's owner.
 *       - `accepted → in_flight` — either side's owner, once
 *                                  `now >= kickoffMs`. League battles
 *                                  stamp each side's `league_stats`
 *                                  bucket (for `scope`) as the
 *                                  baseline; the assert re-reads
 *                                  `league_stats` and rejects a
 *                                  baseline that doesn't match.
 *       - `in_flight → resolved` — either side's owner, once
 *                                  `now >= settleMs`. League scores are
 *                                  the window accuracy (`Δwins/Δcalls`)
 *                                  computed from the frozen baselines
 *                                  and the current `league_stats`; the
 *                                  assert re-derives scores, call
 *                                  counts, and winner and rejects any
 *                                  mismatch, so no writer can post a
 *                                  false result.
 *
 *  4. **Window discipline.** `kickoffMs < settleMs`, both frozen after
 *     `accepted`.
 *
 *  5. **Results write once at resolved.** `scoreA`, `scoreB`,
 *     `callsA`, `callsB`, `winner`, `resolvedAtMs` are unset before
 *     `resolved`. Duels keep manual scores with the winner derived from
 *     the arithmetic (duels have no `league_stats` to delta).
 */
export const assertSetBattle = ({
	caller,
	data: {
		collection,
		key,
		data: { current, proposed }
	}
}: AssertSetDocContext): void => {
	if (collection !== Collection.BATTLES) {
		return;
	}

	const proposedDoc = decodeDocData<BattleDoc>(proposed.data);

	// 1. Key shape.
	if (key !== proposedDoc.id) {
		throw new Error(`battles key mismatch: expected ${proposedDoc.id}, got ${key}.`);
	}

	// Shape validation.
	if (!BATTLE_KINDS.has(proposedDoc.kind)) {
		throw new Error(
			`battles kind must be one of ${[...BATTLE_KINDS].join(' | ')} (got "${proposedDoc.kind}").`
		);
	}

	if (!BATTLE_STATES.has(proposedDoc.state)) {
		throw new Error(
			`battles state must be one of ${[...BATTLE_STATES].join(' | ')} (got "${proposedDoc.state}").`
		);
	}

	if (proposedDoc.kickoffMs >= proposedDoc.settleMs) {
		throw new Error('battles kickoffMs must be strictly before settleMs.');
	}

	// Scope / wager / trash-talk shape — all optional, validated only
	// when present. These are write-once identity fields (enforced on the
	// edit path below); enforcing the bounds here covers the creation
	// path and any same-state proposed-doc edit.
	if (nonNullish(proposedDoc.scope) && !BATTLE_SCOPES.has(proposedDoc.scope)) {
		throw new Error(
			`battles scope must be one of ${[...BATTLE_SCOPES].join(' | ')} (got "${proposedDoc.scope}").`
		);
	}

	if (
		nonNullish(proposedDoc.wager) &&
		(!Number.isFinite(proposedDoc.wager) ||
			proposedDoc.wager < BATTLE_WAGER_MIN ||
			proposedDoc.wager > BATTLE_WAGER_MAX)
	) {
		throw new Error(
			`battles wager must be within [${BATTLE_WAGER_MIN}, ${BATTLE_WAGER_MAX}] (got ${proposedDoc.wager}).`
		);
	}

	if (
		nonNullish(proposedDoc.trashTalk) &&
		proposedDoc.trashTalk.length > BATTLE_TRASH_TALK_MAX_LENGTH
	) {
		throw new Error(
			`battles trashTalk must be at most ${BATTLE_TRASH_TALK_MAX_LENGTH} characters (got ${proposedDoc.trashTalk.length}).`
		);
	}

	// Proposer principal must parse.
	try {
		Principal.fromText(proposedDoc.proposer);
	} catch {
		throw new Error('battles proposer must be a valid principal text.');
	}

	const callerText = Principal.fromUint8Array(caller).toText();

	// Helpers for cross-collection auth lookups.
	const isOwnerOfLeague = (leagueId: string): boolean => {
		const leagueDoc = getDocStore({
			collection: Collection.LEAGUES,
			key: leagueId,
			caller
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

	const isSideOwner = (side: string): boolean =>
		proposedDoc.kind === 'league' ? isOwnerOfLeague(side) : side === callerText;

	const isMemberOfLeague = (leagueId: string): boolean =>
		nonNullish(
			getDocStore({
				collection: Collection.LEAGUE_MEMBERS,
				key: leagueMemberKey({ leagueId, memberPrincipal: callerText }),
				caller
			})
		);

	const isLeagueOpen = (leagueId: string): boolean => {
		const leagueDoc = getDocStore({ collection: Collection.LEAGUES, key: leagueId, caller });

		if (isNullish(leagueDoc)) {
			return false;
		}

		try {
			return leaguePrivacy(decodeDocData<LeagueDoc>(leagueDoc.data)) === LeaguePrivacy.OPEN;
		} catch {
			return false;
		}
	};

	const scope: BattleScope = proposedDoc.scope ?? BATTLE_SCOPE_DEFAULT;

	const readLeagueStatsBucket = (leagueId: string): CategoryStatsBucket => {
		const statsDoc = getDocStore({
			collection: Collection.LEAGUE_STATS,
			key: leagueStatsKey({ leagueId }),
			caller
		});

		if (isNullish(statsDoc)) {
			return leagueStatsBucket(undefined, scope);
		}

		try {
			return leagueStatsBucket(decodeDocData<LeagueStatsDoc>(statsDoc.data), scope);
		} catch {
			return leagueStatsBucket(undefined, scope);
		}
	};

	const nowMs = Number(time() / 1_000_000n);

	// Result fields — set once on the resolve transition, forbidden everywhere else.
	const hasResultFields =
		nonNullish(proposedDoc.scoreA) ||
		nonNullish(proposedDoc.scoreB) ||
		nonNullish(proposedDoc.callsA) ||
		nonNullish(proposedDoc.callsB) ||
		nonNullish(proposedDoc.winner) ||
		nonNullish(proposedDoc.resolvedAtMs);

	const hasBaselineFields = nonNullish(proposedDoc.baselineA) || nonNullish(proposedDoc.baselineB);

	// Creation path: doc must be in `proposed` state, no scores/baselines,
	// proposer-binds-caller, caller is sideA owner, sideB challengeable.
	if (isNullish(current)) {
		if (proposedDoc.state !== 'proposed') {
			throw new Error('New battles must start in state="proposed".');
		}

		if (hasResultFields) {
			throw new Error('New battles must not carry scoreA / scoreB / callsA / callsB / winner.');
		}

		if (hasBaselineFields) {
			throw new Error('New battles must not carry baselineA / baselineB.');
		}

		if (proposedDoc.proposer !== callerText) {
			throw new Error('battles proposer must match the caller principal.');
		}

		if (!isSideOwner(proposedDoc.sideA)) {
			throw new Error(
				'battles proposer must be the owner of sideA (league owner for kind="league", sideA principal for kind="duel").'
			);
		}

		// sideB eligibility (kind='league'): an OPEN league or one the
		// proposer is already a member of. Privacy is discovery-gating, so
		// a non-OPEN league can only be challenged from the inside.
		if (
			proposedDoc.kind === 'league' &&
			!isLeagueOpen(proposedDoc.sideB) &&
			!isMemberOfLeague(proposedDoc.sideB)
		) {
			throw new Error('battles sideB must be an OPEN league or one the proposer is a member of.');
		}

		return;
	}

	// Edit path — enforce identity-field immutability, state-machine
	// transitions, and per-state authorisation.
	const currentDoc = decodeDocData<BattleDoc>(current.data);

	if (
		currentDoc.id !== proposedDoc.id ||
		currentDoc.kind !== proposedDoc.kind ||
		currentDoc.sideA !== proposedDoc.sideA ||
		currentDoc.sideB !== proposedDoc.sideB ||
		currentDoc.proposer !== proposedDoc.proposer ||
		currentDoc.scope !== proposedDoc.scope ||
		currentDoc.wager !== proposedDoc.wager ||
		currentDoc.trashTalk !== proposedDoc.trashTalk
	) {
		throw new Error(
			'battles identity fields are immutable (id, kind, sideA, sideB, proposer, scope, wager, trashTalk).'
		);
	}

	// Window discipline — kickoffMs / settleMs immutable after
	// `accepted` (only the proposed-state-only "edit-window" branch
	// can change them, and we don't allow re-editing in `proposed`
	// either; identity-field-immutability already covers the
	// in-state case if scopes drift).
	if (
		currentDoc.state !== 'proposed' &&
		(currentDoc.kickoffMs !== proposedDoc.kickoffMs || currentDoc.settleMs !== proposedDoc.settleMs)
	) {
		throw new Error('battles kickoffMs / settleMs are frozen after the proposed state.');
	}

	// Baselines are stamped on the accepted → in_flight transition and
	// frozen thereafter. They may only appear/change on a doc whose
	// current state is `accepted`.
	if (
		currentDoc.state !== 'accepted' &&
		(!bucketsNullableEqual(currentDoc.baselineA, proposedDoc.baselineA) ||
			!bucketsNullableEqual(currentDoc.baselineB, proposedDoc.baselineB))
	) {
		throw new Error('battles baselineA / baselineB are frozen after kickoff.');
	}

	// State machine — only valid forward transitions allowed.
	if (currentDoc.state !== proposedDoc.state) {
		const allowed = BATTLE_TRANSITIONS[currentDoc.state];

		if (!allowed.has(proposedDoc.state)) {
			throw new Error(
				`battles state may only transition forward (${currentDoc.state} → ${[...allowed].join(' | ') || 'terminal'}); got ${proposedDoc.state}.`
			);
		}
	}

	// Per-transition authorisation.
	const transition = `${currentDoc.state}->${proposedDoc.state}`;

	if (transition === 'proposed->accepted') {
		// The opposite side's owner accepts.
		if (!isSideOwner(currentDoc.sideB)) {
			throw new Error('battles accept requires sideB owner.');
		}

		if (hasResultFields || hasBaselineFields) {
			throw new Error('battles accept must not carry scores or baselines.');
		}
	} else if (transition === 'accepted->in_flight') {
		if (!isSideOwner(currentDoc.sideA) && !isSideOwner(currentDoc.sideB)) {
			throw new Error('battles kickoff requires sideA or sideB owner.');
		}

		if (hasResultFields) {
			throw new Error('battles kickoff must not carry scoreA / scoreB / callsA / callsB / winner.');
		}

		if (nowMs < currentDoc.kickoffMs) {
			throw new Error('battles cannot kick off before kickoffMs.');
		}

		if (proposedDoc.kind === 'league') {
			// League battles snapshot the current league_stats bucket as the
			// baseline. The assert re-reads it so the baseline can't be faked.
			if (isNullish(proposedDoc.baselineA) || isNullish(proposedDoc.baselineB)) {
				throw new Error('league battles require baselineA and baselineB at kickoff.');
			}

			if (
				!bucketsEqual(proposedDoc.baselineA, readLeagueStatsBucket(currentDoc.sideA)) ||
				!bucketsEqual(proposedDoc.baselineB, readLeagueStatsBucket(currentDoc.sideB))
			) {
				throw new Error('battles kickoff baselines must equal the current league_stats snapshot.');
			}
		} else if (hasBaselineFields) {
			throw new Error('duel battles must not carry baselines.');
		}
	} else if (transition === 'in_flight->resolved') {
		if (!isSideOwner(currentDoc.sideA) && !isSideOwner(currentDoc.sideB)) {
			throw new Error('battles resolve requires sideA or sideB owner.');
		}

		if (nowMs < currentDoc.settleMs) {
			throw new Error('battles cannot resolve before settleMs.');
		}

		if (isNullish(proposedDoc.scoreA) || isNullish(proposedDoc.scoreB)) {
			throw new Error('battles state="resolved" requires scoreA and scoreB.');
		}

		if (proposedDoc.kind === 'league') {
			// Re-derive the windowed result from the frozen baselines and the
			// current league_stats. Any score the writer didn't compute from
			// real data is rejected — this is the integrity guarantee.
			if (isNullish(currentDoc.baselineA) || isNullish(currentDoc.baselineB)) {
				throw new Error('league battles cannot resolve without kickoff baselines.');
			}

			if (isNullish(proposedDoc.callsA) || isNullish(proposedDoc.callsB)) {
				throw new Error('league battles state="resolved" requires callsA and callsB.');
			}

			const deltaA = deltaBucket(currentDoc.baselineA, readLeagueStatsBucket(currentDoc.sideA));
			const deltaB = deltaBucket(currentDoc.baselineB, readLeagueStatsBucket(currentDoc.sideB));
			const expectedScoreA = battleAccuracyPct(deltaA);
			const expectedScoreB = battleAccuracyPct(deltaB);
			const expectedWinner = deriveBattleWinner({
				scoreA: expectedScoreA,
				scoreB: expectedScoreB,
				callsA: deltaA.calls,
				callsB: deltaB.calls
			});

			if (
				proposedDoc.scoreA !== expectedScoreA ||
				proposedDoc.scoreB !== expectedScoreB ||
				proposedDoc.callsA !== deltaA.calls ||
				proposedDoc.callsB !== deltaB.calls ||
				proposedDoc.winner !== expectedWinner
			) {
				throw new Error('battles resolution must match the league_stats window delta.');
			}
		} else {
			// Duel — manual scores, winner from arithmetic (no league_stats).
			if (nonNullish(proposedDoc.callsA) || nonNullish(proposedDoc.callsB)) {
				throw new Error('duel battles must not carry callsA / callsB.');
			}

			const derivedWinner: BattleWinner =
				proposedDoc.scoreA > proposedDoc.scoreB
					? 'A'
					: proposedDoc.scoreA < proposedDoc.scoreB
						? 'B'
						: 'draw';

			if (proposedDoc.winner !== derivedWinner) {
				throw new Error(
					`battles winner must match score arithmetic (expected ${derivedWinner}, got ${proposedDoc.winner ?? 'undefined'}).`
				);
			}
		}
	} else if (currentDoc.state === proposedDoc.state) {
		// Same-state writes (e.g. fix a typo before accept) require
		// the proposer for `proposed`, otherwise lock out — most
		// fields are immutable so there's not much to edit.
		if (currentDoc.state === 'proposed' && proposedDoc.proposer !== callerText) {
			throw new Error('battles edits in proposed state require the proposer.');
		}

		if (currentDoc.state !== 'proposed') {
			throw new Error(
				`battles in state="${currentDoc.state}" cannot be edited without a forward transition.`
			);
		}

		if (hasResultFields || hasBaselineFields) {
			throw new Error('battles pre-resolved must not carry scores or baselines.');
		}
	}
};

/**
 * Pre-write guard for `battles` deletes — proposed-only retract path.
 *
 *  1. **Collection scope.** No-op for any non-battles collection.
 *  2. **Proposer binds caller.** Only the original proposer can
 *     retract — neither opponent nor admin gets a delete path.
 *  3. **Proposed state only.** Once `accepted`, the battle is part of
 *     both leagues' shared history and becomes immutable (and so
 *     undeletable). Anything past `proposed` must run the resolved
 *     terminal transition instead.
 */
export const assertDeleteBattle = ({
	caller,
	data: {
		collection,
		data: { current }
	}
}: AssertDeleteDocContext): void => {
	if (collection !== Collection.BATTLES) {
		return;
	}

	if (isNullish(current)) {
		return;
	}

	const currentDoc = decodeDocData<BattleDoc>(current.data);

	// 2. Proposer binds caller.
	const callerText = Principal.fromUint8Array(caller).toText();

	if (currentDoc.proposer !== callerText) {
		throw new Error('battles may only be retracted by the original proposer.');
	}

	// 3. Proposed state only.
	if (currentDoc.state !== 'proposed') {
		throw new Error(
			`battles in state="${currentDoc.state}" are immutable history — retract is only valid while state="proposed".`
		);
	}
};
