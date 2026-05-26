import { Collection } from '$lib/constants/collections.constants';
import {
	LEAGUE_DESCRIPTION_MAX_LENGTH,
	LEAGUE_INVITE_CODE_REGEX,
	LEAGUE_NAME_MAX_LENGTH,
	LEAGUE_NAME_MIN_LENGTH,
	type LeagueDoc
} from '$lib/types/league';
import { leagueMemberKey, type LeagueMemberDoc } from '$lib/types/league-member';
import { isNullish, nonNullish } from '@dfinity/utils';
import { Principal } from '@icp-sdk/core/principal';
import type { AssertSetDocContext } from '@junobuild/functions';
import { msgCaller } from '@junobuild/functions/ic-cdk';
import { decodeDocData, encodeDocData, getDocStore, setDocStore } from '@junobuild/functions/sdk';

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
 *  2. **Authorisation.** On creation, the caller becomes the owner
 *     (`proposed.owner === caller`). On edits, the *current* owner is
 *     the only principal that can write — but they're free to flip
 *     `owner` to any valid principal (transfer-of-ownership flow).
 *     The owner-rotation invariant is "only the outgoing owner can
 *     authorise the swap"; the new owner must already be a member of
 *     the league (enforced by the endpoint, not this assert, since
 *     the assert can't cheaply scan `league_members`).
 *
 *  3. **Identity fields are immutable.** `id`, `createdAtMs`, and
 *     `inviteCode` are write-once. Even the owner can't rotate the
 *     invite code after creation — the join-by-code flow relies on
 *     codes being stable for the league's lifetime. `owner` is the
 *     one exception (see §2 above).
 *
 *  4. **Shape validation.** Name 3–40 chars, description ≤240 chars,
 *     invite code matches `[A-Z0-9]{6}`. Owner is a valid principal
 *     text.
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

	const callerText = Principal.fromUint8Array(caller).toText();

	// Creation path — caller must equal proposed owner. No `current`
	// to compare against, so the "current owner authorises edits"
	// rule below doesn't apply.
	if (isNullish(current)) {
		if (proposedDoc.owner !== callerText) {
			throw new Error('leagues owner must match the caller principal on creation.');
		}

		return;
	}

	const currentDoc = decodeDocData<LeagueDoc>(current.data);

	// 2 (edit path). The current owner is the only principal that
	// can edit. The transfer-of-ownership endpoint impersonates the
	// outgoing owner (msgCaller) for the swap, then impersonates the
	// new owner for the membership-role updates.
	if (currentDoc.owner !== callerText) {
		throw new Error('leagues edits must be made by the current owner.');
	}

	// 3. Identity fields are immutable on edits — `owner` is now
	// editable, the rest stay frozen.
	if (
		currentDoc.id !== proposedDoc.id ||
		currentDoc.createdAtMs !== proposedDoc.createdAtMs ||
		currentDoc.inviteCode !== proposedDoc.inviteCode
	) {
		throw new Error('leagues identity fields are immutable (id, createdAtMs, inviteCode).');
	}
};

/**
 * League ownership transfer — defineUpdate handler.
 *
 * The flow runs three writes in order:
 *
 *  1. Flip `LEAGUES[leagueId].owner` from the outgoing owner (the
 *     caller) to the new owner. Done as the *outgoing* owner so the
 *     assert's "edits made by current owner" rule accepts the swap.
 *  2. Promote `LEAGUE_MEMBERS[${leagueId}/${newOwner}]` to
 *     `role='owner'`. Done as the *new* owner — by this point
 *     `league.owner === newOwner`, so the assert's "callerIsOwner"
 *     branch passes and the "owner role reserved for league owner
 *     principal" check also passes.
 *  3. Demote `LEAGUE_MEMBERS[${leagueId}/${oldOwner}]` from
 *     `role='owner'` to `role='admin'`. Done as the *new* owner for
 *     the same reason as step 2.
 *
 * The writes aren't atomic. If a step fails after step 1 commits the
 * league has a new `owner` field but the old member-row hint is
 * stale. The system stays functional (every authorisation downstream
 * reads `league.owner`, not the member-row role), but a follow-up
 * call would idempotently complete the missing role updates. For v1
 * we accept the partial-failure risk; a future "owner-row drift"
 * background sweeper can repair stragglers.
 *
 * Refusal reasons:
 *  - `not_owner` — caller is not the current owner.
 *  - `league_not_found` — leagueId has no doc.
 *  - `new_owner_not_member` — target principal isn't a member of the
 *    league. (Required by the prototype's social model — only a
 *    current member can become owner.)
 *  - `new_owner_is_caller` — caller is trying to transfer to
 *    themselves; a no-op we reject explicitly so the FE can render
 *    a clearer error than a silent success.
 *  - `invalid_input` — `newOwnerPrincipal` is not a valid principal
 *    text.
 */

export type TransferLeagueOwnershipRefusalReason =
	| 'not_owner'
	| 'league_not_found'
	| 'new_owner_not_member'
	| 'new_owner_is_caller'
	| 'invalid_input';

export interface TransferLeagueOwnershipResult {
	ok: boolean;
	reason?: TransferLeagueOwnershipRefusalReason;
}

export const transferLeagueOwnershipFn = ({
	leagueId,
	newOwnerPrincipal
}: {
	leagueId: string;
	newOwnerPrincipal: string;
}): TransferLeagueOwnershipResult => {
	let newOwner: Principal;

	try {
		newOwner = Principal.fromText(newOwnerPrincipal);
	} catch {
		return { ok: false, reason: 'invalid_input' };
	}

	const caller = msgCaller();
	const callerText = caller.toText();
	const callerBytes = caller.toUint8Array();
	const newOwnerText = newOwner.toText();
	const newOwnerBytes = newOwner.toUint8Array();

	if (callerText === newOwnerText) {
		return { ok: false, reason: 'new_owner_is_caller' };
	}

	// Read the league as the caller. If the league doc isn't visible
	// or doesn't exist, refuse.
	const leagueDoc = getDocStore({
		collection: Collection.LEAGUES,
		key: leagueId,
		caller: callerBytes
	});

	if (isNullish(leagueDoc)) {
		return { ok: false, reason: 'league_not_found' };
	}

	const league = decodeDocData<LeagueDoc>(leagueDoc.data);

	if (league.owner !== callerText) {
		return { ok: false, reason: 'not_owner' };
	}

	// Confirm the new owner is a member of the league. Their member
	// row must already exist; we read it here and reuse the `version`
	// stamp when we promote it to `owner` in step 2.
	const newOwnerMemberKey = leagueMemberKey({
		leagueId,
		memberPrincipal: newOwnerText
	});

	const newOwnerMemberDoc = getDocStore({
		collection: Collection.LEAGUE_MEMBERS,
		key: newOwnerMemberKey,
		caller: callerBytes
	});

	if (isNullish(newOwnerMemberDoc)) {
		return { ok: false, reason: 'new_owner_not_member' };
	}

	const oldOwnerMemberKey = leagueMemberKey({
		leagueId,
		memberPrincipal: callerText
	});

	const oldOwnerMemberDoc = getDocStore({
		collection: Collection.LEAGUE_MEMBERS,
		key: oldOwnerMemberKey,
		caller: callerBytes
	});

	// Step 1 — flip league.owner. Caller is the outgoing owner.
	setDocStore({
		collection: Collection.LEAGUES,
		key: leagueId,
		caller: callerBytes,
		doc: {
			data: encodeDocData<LeagueDoc>({
				...league,
				owner: newOwnerText
			}),
			version: leagueDoc.version
		}
	});

	// Step 2 — promote the new owner's member row. From here on we
	// impersonate the new owner so the assert sees `callerIsOwner`
	// (which is true now that league.owner has flipped).
	const newOwnerMember = decodeDocData<LeagueMemberDoc>(newOwnerMemberDoc.data);

	setDocStore({
		collection: Collection.LEAGUE_MEMBERS,
		key: newOwnerMemberKey,
		caller: newOwnerBytes,
		doc: {
			data: encodeDocData<LeagueMemberDoc>({
				...newOwnerMember,
				role: 'owner'
			}),
			version: newOwnerMemberDoc.version
		}
	});

	// Step 3 — demote the old owner's member row to `admin`. The
	// member doc *should* exist (every owner has a corresponding
	// `role='owner'` member row), but defensively skip if missing
	// — we've already swapped league.owner so the auth model is
	// consistent regardless.
	if (nonNullish(oldOwnerMemberDoc)) {
		const oldOwnerMember = decodeDocData<LeagueMemberDoc>(oldOwnerMemberDoc.data);

		setDocStore({
			collection: Collection.LEAGUE_MEMBERS,
			key: oldOwnerMemberKey,
			caller: newOwnerBytes,
			doc: {
				data: encodeDocData<LeagueMemberDoc>({
					...oldOwnerMember,
					role: 'admin'
				}),
				version: oldOwnerMemberDoc.version
			}
		});
	}

	return { ok: true };
};
