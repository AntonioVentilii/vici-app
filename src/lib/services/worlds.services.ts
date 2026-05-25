import { functions } from '$declarations/satellite/satellite.api';
import { Collection } from '$lib/constants/collections.constants';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import {
	AFFILIATION_LOCK_MS,
	affiliationKey,
	type AffiliationDoc,
	type AffiliationKind
} from '$lib/types/affiliation';
import { deleteDoc, getDoc, setDoc } from '@junobuild/core';

/**
 * V1.2 Worlds affiliations — thin FE service wrapping the satellite
 * read queries + the write / delete primitives via `@junobuild/core`.
 * Mirrors the leagues service shape; consumers (Worlds picker page,
 * Worlds detail / leaderboard) import the camelCase domain types
 * from here.
 *
 * The 90-day lock is enforced server-side by `assertSetAffiliation`
 * (locked computed from joinedAtMs) and `assertDeleteAffiliation`
 * (delete blocked until lock expires). The FE pre-empts the
 * lock-active branch with a `Date.now()` check so the user sees a
 * disabled-leave CTA instead of a thrown error.
 */

/**
 * Returns the caller's current `{ university?, country? }` pair.
 */
export const listMyAffiliations = async (): Promise<{
	university?: AffiliationDoc;
	country?: AffiliationDoc;
}> => {
	const { university, country } = await functions.listMyAffiliations();

	const project = (wire: NonNullable<typeof university>): AffiliationDoc => ({
		member: wire.member,
		kind: wire.kind,
		affiliationId: wire.affiliation_id,
		joinedAtMs: wire.joined_at_ms,
		lockedUntilMs: wire.locked_until_ms
	});

	return {
		university: university ? project(university) : undefined,
		country: country ? project(country) : undefined
	};
};

/**
 * Join an affiliation. Server computes the lock window from
 * `joinedAtMs`; the FE writes the matching `lockedUntilMs` so the
 * assert accepts. A pre-existing row for the same `(member, kind)`
 * means the slot is locked — throws with a clear error so the UI
 * surfaces a "switch after lock" state instead of failing on the
 * satellite assert.
 */
export const joinAffiliation = async ({
	kind,
	affiliationId
}: {
	kind: AffiliationKind;
	affiliationId: string;
}): Promise<AffiliationDoc> => {
	const identity = await safeGetIdentityOnce();
	const memberPrincipal = identity.getPrincipal().toText();
	const joinedAtMs = Date.now();
	const lockedUntilMs = joinedAtMs + AFFILIATION_LOCK_MS;
	const key = affiliationKey({ memberPrincipal, kind, affiliationId });

	// Pre-empt the "second slot of same kind" branch with a getDoc.
	// The doc key carries `${kind}/${id}` so the existing row would be
	// keyed differently (different id) for a fresh switch — but checking
	// any-row-for-the-kind needs a scan; defer that to the picker UI
	// which derives state from `listMyAffiliations`.
	const existing = await getDoc<AffiliationDoc>({
		collection: Collection.AFFILIATIONS,
		key
	});

	if (existing) {
		throw new Error('Already affiliated with this option.');
	}

	const doc: AffiliationDoc = {
		member: memberPrincipal,
		kind,
		affiliationId,
		joinedAtMs,
		lockedUntilMs
	};

	await setDoc<AffiliationDoc>({
		collection: Collection.AFFILIATIONS,
		doc: { key, data: doc }
	});

	return doc;
};

/**
 * Leave an affiliation — `deleteDoc` against the row. The satellite
 * assert hard-rejects if the lock hasn't expired; the FE should
 * disable the CTA pre-emptively (read `lockedUntilMs` vs
 * `Date.now()`) so users see the gate clearly.
 */
export const leaveAffiliation = async ({
	kind,
	affiliationId
}: {
	kind: AffiliationKind;
	affiliationId: string;
}): Promise<void> => {
	const identity = await safeGetIdentityOnce();
	const memberPrincipal = identity.getPrincipal().toText();
	const key = affiliationKey({ memberPrincipal, kind, affiliationId });

	const existing = await getDoc<AffiliationDoc>({
		collection: Collection.AFFILIATIONS,
		key
	});

	if (!existing) {
		// Idempotent — nothing to delete.
		return;
	}

	await deleteDoc<AffiliationDoc>({
		collection: Collection.AFFILIATIONS,
		doc: existing
	});
};

/**
 * Pure helper for the UI — days remaining on a lock. Returns 0 once
 * the lock has expired so the FE can flip the CTA to "Leave".
 */
export const affiliationDaysLeft = ({
	lockedUntilMs,
	nowMs = Date.now()
}: {
	lockedUntilMs: number;
	nowMs?: number;
}): number => {
	const remaining = lockedUntilMs - nowMs;

	return remaining <= 0 ? 0 : Math.ceil(remaining / (24 * 60 * 60 * 1000));
};
