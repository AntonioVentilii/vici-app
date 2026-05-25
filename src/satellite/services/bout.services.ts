import { Collection } from '$lib/constants/collections.constants';
import {
	BOUT_KINDS,
	BOUT_STATES,
	BOUT_TRANSITIONS,
	type BoutDoc,
	type BoutWinner
} from '$lib/types/bout';
import type { LeagueDoc } from '$lib/types/league';
import { isNullish, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import type { AssertDeleteDocContext, AssertSetDocContext } from '@junobuild/functions';
import { decodeDocData, getDocStore } from '@junobuild/functions/sdk';

/**
 * Pre-write guard for `bouts`. Enforces the V1.2 time-bound
 * competition state machine + the per-state authorisation model.
 *
 *  1. **Key shape.** Doc key equals the embedded `id`.
 *
 *  2. **Identity fields immutable.** `id`, `kind`, `sideA`, `sideB`,
 *     `proposer` are write-once.
 *
 *  3. **State machine.** Forward-only per `BOUT_TRANSITIONS`. New
 *     docs start at `proposed`. Each transition is gated by:
 *
 *       - `proposed`        — caller is the proposer (and is also
 *                             league.owner of sideA for kind='league',
 *                             or sideA principal for kind='duel').
 *       - `proposed → accepted` — caller is the *other* side's owner
 *                                 (league.owner of sideB / sideB
 *                                 principal). Kickoff / settle are
 *                                 frozen at this point.
 *       - `accepted → in_flight` — either side's owner can flip once
 *                                  `now >= kickoffMs`.
 *       - `in_flight → resolved` — either side's owner can flip once
 *                                  `now >= settleMs`. Scores +
 *                                  winner write here, derived
 *                                  consistently.
 *
 *  4. **Window discipline.** `kickoffMs < settleMs`. Both are frozen
 *     after `accepted` so neither side can edge the window in their
 *     favour mid-flight.
 *
 *  5. **Scores write once at resolved.** `scoreA`, `scoreB`, and
 *     `winner` must be unset before `resolved` and set on the
 *     transition. `winner` must match the score arithmetic (A wins
 *     ⇔ scoreA > scoreB; draw ⇔ equal).
 */
export const assertSetBout = ({
	caller,
	data: {
		collection,
		key,
		data: { current, proposed }
	}
}: AssertSetDocContext): void => {
	if (collection !== Collection.BOUTS) {
		return;
	}

	const proposedDoc = decodeDocData<BoutDoc>(proposed.data);

	// 1. Key shape.
	if (key !== proposedDoc.id) {
		throw new Error(`bouts key mismatch: expected ${proposedDoc.id}, got ${key}.`);
	}

	// Shape validation.
	if (!BOUT_KINDS.has(proposedDoc.kind)) {
		throw new Error(
			`bouts kind must be one of ${[...BOUT_KINDS].join(' | ')} (got "${proposedDoc.kind}").`
		);
	}

	if (!BOUT_STATES.has(proposedDoc.state)) {
		throw new Error(
			`bouts state must be one of ${[...BOUT_STATES].join(' | ')} (got "${proposedDoc.state}").`
		);
	}

	if (proposedDoc.kickoffMs >= proposedDoc.settleMs) {
		throw new Error('bouts kickoffMs must be strictly before settleMs.');
	}

	// Proposer principal must parse.
	try {
		Principal.fromText(proposedDoc.proposer);
	} catch {
		throw new Error('bouts proposer must be a valid principal text.');
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

	// 5 (partial). `resolved` state requires scores + winner; other
	// states must NOT carry them.
	const hasScoreFields =
		nonNullish(proposedDoc.scoreA) ||
		nonNullish(proposedDoc.scoreB) ||
		nonNullish(proposedDoc.winner);

	// Creation path: doc must be in `proposed` state, no scores,
	// proposer-binds-caller, caller is sideA owner.
	if (isNullish(current)) {
		if (proposedDoc.state !== 'proposed') {
			throw new Error('New bouts must start in state="proposed".');
		}

		if (hasScoreFields) {
			throw new Error('New bouts must not carry scoreA / scoreB / winner.');
		}

		if (proposedDoc.proposer !== callerText) {
			throw new Error('bouts proposer must match the caller principal.');
		}

		if (!isSideOwner(proposedDoc.sideA)) {
			throw new Error(
				'bouts proposer must be the owner of sideA (league owner for kind="league", sideA principal for kind="duel").'
			);
		}

		return;
	}

	// Edit path — enforce identity-field immutability, state-machine
	// transitions, and per-state authorisation.
	const currentDoc = decodeDocData<BoutDoc>(current.data);

	if (
		currentDoc.id !== proposedDoc.id ||
		currentDoc.kind !== proposedDoc.kind ||
		currentDoc.sideA !== proposedDoc.sideA ||
		currentDoc.sideB !== proposedDoc.sideB ||
		currentDoc.proposer !== proposedDoc.proposer
	) {
		throw new Error('bouts identity fields are immutable (id, kind, sideA, sideB, proposer).');
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
		throw new Error('bouts kickoffMs / settleMs are frozen after the proposed state.');
	}

	// State machine — only valid forward transitions allowed.
	if (currentDoc.state !== proposedDoc.state) {
		const allowed = BOUT_TRANSITIONS[currentDoc.state];

		if (!allowed.has(proposedDoc.state)) {
			throw new Error(
				`bouts state may only transition forward (${currentDoc.state} → ${[...allowed].join(' | ') || 'terminal'}); got ${proposedDoc.state}.`
			);
		}
	}

	// Per-transition authorisation.
	const transition = `${currentDoc.state}->${proposedDoc.state}`;

	if (transition === 'proposed->accepted') {
		// The opposite side's owner accepts.
		if (!isSideOwner(currentDoc.sideB)) {
			throw new Error('bouts accept requires sideB owner.');
		}

		if (hasScoreFields) {
			throw new Error('bouts accept must not carry scoreA / scoreB / winner.');
		}
	} else if (transition === 'accepted->in_flight') {
		if (!isSideOwner(currentDoc.sideA) && !isSideOwner(currentDoc.sideB)) {
			throw new Error('bouts kickoff requires sideA or sideB owner.');
		}

		if (hasScoreFields) {
			throw new Error('bouts kickoff must not carry scoreA / scoreB / winner.');
		}
	} else if (transition === 'in_flight->resolved') {
		if (!isSideOwner(currentDoc.sideA) && !isSideOwner(currentDoc.sideB)) {
			throw new Error('bouts resolve requires sideA or sideB owner.');
		}

		// 5. Scores write here.
		if (isNullish(proposedDoc.scoreA) || isNullish(proposedDoc.scoreB)) {
			throw new Error('bouts state="resolved" requires scoreA and scoreB.');
		}

		// 5. Winner must match score arithmetic.
		const derivedWinner: BoutWinner =
			proposedDoc.scoreA > proposedDoc.scoreB
				? 'A'
				: proposedDoc.scoreA < proposedDoc.scoreB
					? 'B'
					: 'draw';

		if (proposedDoc.winner !== derivedWinner) {
			throw new Error(
				`bouts winner must match score arithmetic (expected ${derivedWinner}, got ${proposedDoc.winner ?? 'undefined'}).`
			);
		}
	} else if (currentDoc.state === proposedDoc.state) {
		// Same-state writes (e.g. fix a typo before accept) require
		// the proposer for `proposed`, otherwise lock out — most
		// fields are immutable so there's not much to edit.
		if (currentDoc.state === 'proposed' && proposedDoc.proposer !== callerText) {
			throw new Error('bouts edits in proposed state require the proposer.');
		}

		if (currentDoc.state !== 'proposed') {
			throw new Error(
				`bouts in state="${currentDoc.state}" cannot be edited without a forward transition.`
			);
		}

		if (hasScoreFields) {
			throw new Error('bouts pre-resolved must not carry scoreA / scoreB / winner.');
		}
	}
};

/**
 * Pre-write guard for `bouts` deletes — proposed-only retract path.
 *
 *  1. **Collection scope.** No-op for any non-bouts collection.
 *  2. **Proposer binds caller.** Only the original proposer can
 *     retract — neither opponent nor admin gets a delete path.
 *  3. **Proposed state only.** Once `accepted`, the bout is part of
 *     both leagues' shared history and becomes immutable (and so
 *     undeletable). Anything past `proposed` must run the resolved
 *     terminal transition instead.
 */
export const assertDeleteBout = ({
	caller,
	data: {
		collection,
		data: { current }
	}
}: AssertDeleteDocContext): void => {
	if (collection !== Collection.BOUTS) {
		return;
	}

	if (isNullish(current)) {
		return;
	}

	const currentDoc = decodeDocData<BoutDoc>(current.data);

	// 2. Proposer binds caller.
	const callerText = Principal.fromUint8Array(caller).toText();

	if (currentDoc.proposer !== callerText) {
		throw new Error('bouts may only be retracted by the original proposer.');
	}

	// 3. Proposed state only.
	if (currentDoc.state !== 'proposed') {
		throw new Error(
			`bouts in state="${currentDoc.state}" are immutable history — retract is only valid while state="proposed".`
		);
	}
};
