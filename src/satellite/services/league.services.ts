import { Collection } from '$lib/constants/collections.constants';
import {
	LEAGUE_DESCRIPTION_MAX_LENGTH,
	LEAGUE_INVITE_CODE_REGEX,
	LEAGUE_NAME_MAX_LENGTH,
	LEAGUE_NAME_MIN_LENGTH,
	type LeagueDoc
} from '$lib/types/league';
import { isNullish, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import type { AssertSetDocContext } from '@junobuild/functions';
import { decodeDocData } from '@junobuild/functions/sdk';

/**
 * Pre-write guard for `leagues`. The collection holds prototype social
 * cohorts; the rules here keep league identity stable across the
 * lifetime of the cohort so the join-by-code flow + standings
 * leaderboards can trust the metadata.
 *
 *  1. **Key shape.** The doc key must equal the embedded `id`.
 *     Drift between key and id is the most common path to a duplicate
 *     league slipping through; this assertion makes it impossible.
 *
 *  2. **Owner binds caller.** A user can only create a league owned
 *     by themselves. Edits must also be made by the owner principal
 *     (membership changes / transfer of ownership land in a follow-up
 *     collection so they don't muddy this rule).
 *
 *  3. **Identity fields are immutable.** `id`, `owner`, `createdAtMs`,
 *     `inviteCode` are write-once. Even the owner can't rotate the
 *     invite code after creation — the join-by-code flow relies on
 *     codes being stable for the league's lifetime.
 *
 *  4. **Shape validation.** Name 3–40 chars, description ≤240 chars,
 *     invite code matches `[A-Z0-9]{6}`. Owner is a valid principal
 *     text.
 *
 * Follow-up commits will add `league_members` (membership table) and
 * `bouts` (the time-bound competition state machine). Both reference
 * `LeagueDoc.id` so the integrity guarantees here are load-bearing for
 * the whole social-cohort surface.
 */
export const assertSetLeague = ({
	caller,
	data: {
		collection,
		key,
		data: { current, proposed }
	}
}: AssertSetDocContext): void => {
	if (collection !== Collection.LEAGUES) {
		return;
	}

	const proposedDoc = decodeDocData<LeagueDoc>(proposed.data);

	// 1. Key shape — must match the embedded id.
	if (key !== proposedDoc.id) {
		throw new Error(`leagues key mismatch: expected ${proposedDoc.id}, got ${key}.`);
	}

	// 2. Shape validation.
	if (
		proposedDoc.name.length < LEAGUE_NAME_MIN_LENGTH ||
		proposedDoc.name.length > LEAGUE_NAME_MAX_LENGTH
	) {
		throw new Error(
			`leagues name must be ${LEAGUE_NAME_MIN_LENGTH}–${LEAGUE_NAME_MAX_LENGTH} chars (got ${proposedDoc.name.length}).`
		);
	}

	if (
		nonNullish(proposedDoc.description) &&
		proposedDoc.description.length > LEAGUE_DESCRIPTION_MAX_LENGTH
	) {
		throw new Error(`leagues description must be at most ${LEAGUE_DESCRIPTION_MAX_LENGTH} chars.`);
	}

	if (!LEAGUE_INVITE_CODE_REGEX.test(proposedDoc.inviteCode)) {
		throw new Error(
			`leagues inviteCode must match ${LEAGUE_INVITE_CODE_REGEX} (got "${proposedDoc.inviteCode}").`
		);
	}

	// Owner principal must parse — defensive against malformed writes.
	try {
		Principal.fromText(proposedDoc.owner);
	} catch {
		throw new Error('leagues owner must be a valid principal text.');
	}

	// 3. Owner binds caller.
	const callerText = Principal.fromUint8Array(caller).toText();

	if (proposedDoc.owner !== callerText) {
		throw new Error('leagues owner must match the caller principal.');
	}

	// Creation path — nothing more to check beyond shape.
	if (isNullish(current)) {
		return;
	}

	// 4. Identity fields are immutable on edits.
	const currentDoc = decodeDocData<LeagueDoc>(current.data);

	if (
		currentDoc.id !== proposedDoc.id ||
		currentDoc.owner !== proposedDoc.owner ||
		currentDoc.createdAtMs !== proposedDoc.createdAtMs ||
		currentDoc.inviteCode !== proposedDoc.inviteCode
	) {
		throw new Error('leagues identity fields are immutable (id, owner, createdAtMs, inviteCode).');
	}
};
