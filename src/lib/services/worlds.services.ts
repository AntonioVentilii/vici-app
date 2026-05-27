import { functions } from '$declarations/satellite/satellite.api';
import { Collection } from '$lib/constants/collections.constants';
import { safeGetIdentityOnce } from '$lib/services/identity.services';
import {
	AFFILIATION_LOCK_MS,
	affiliationKey,
	type AffiliationDoc,
	type AffiliationKind
} from '$lib/types/affiliation';
import type { AffiliationStatsDoc } from '$lib/types/affiliation-stats';
import { deleteDoc, getDoc, setDoc } from '@junobuild/core';

/**
 * Hard timeout for the affiliation write path. Generous enough to cover
 * a slow IC update call (typical ~2s, occasionally longer), tight
 * enough that the picker's "joining…" spinner doesn't hang indefinitely
 * — which is what Giova observed on 2026-05-27 when a country pick
 * never resolved and never rejected, leaving the row stuck and the
 * `finally { saving = null }` branch unreachable.
 */
const AFFILIATION_WRITE_TIMEOUT_MS = 15_000;

const withTimeout = <T>({
	operation,
	timeoutMs,
	label
}: {
	operation: Promise<T>;
	timeoutMs: number;
	label: string;
}): Promise<T> =>
	Promise.race<T>([
		operation,
		new Promise<T>((_, reject) => {
			setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
		})
	]);

/**
 * Worlds affiliations — thin FE service wrapping the satellite
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
	const existing = await withTimeout({
		operation: getDoc<AffiliationDoc>({
			collection: Collection.AFFILIATIONS,
			key
		}),
		timeoutMs: AFFILIATION_WRITE_TIMEOUT_MS,
		label: 'joinAffiliation:getDoc'
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

	await withTimeout({
		operation: setDoc<AffiliationDoc>({
			collection: Collection.AFFILIATIONS,
			doc: { key, data: doc }
		}),
		timeoutMs: AFFILIATION_WRITE_TIMEOUT_MS,
		label: 'joinAffiliation:setDoc'
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

	const existing = await withTimeout({
		operation: getDoc<AffiliationDoc>({
			collection: Collection.AFFILIATIONS,
			key
		}),
		timeoutMs: AFFILIATION_WRITE_TIMEOUT_MS,
		label: 'leaveAffiliation:getDoc'
	});

	if (!existing) {
		// Idempotent — nothing to delete.
		return;
	}

	await withTimeout({
		operation: deleteDoc<AffiliationDoc>({
			collection: Collection.AFFILIATIONS,
			doc: existing
		}),
		timeoutMs: AFFILIATION_WRITE_TIMEOUT_MS,
		label: 'leaveAffiliation:deleteDoc'
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

/**
 * Project the satellite's snake_case wire schema for affiliation
 * stats to FE camelCase.
 */
const projectStatsWire = (s: {
	affiliation_id: string;
	kind: AffiliationKind;
	total_calls: number;
	wins: number;
	month_anchor: string;
	month_total_calls: number;
	month_wins: number;
	updated_at_ms: number;
}): AffiliationStatsDoc => ({
	affiliationId: s.affiliation_id,
	kind: s.kind,
	totalCalls: s.total_calls,
	wins: s.wins,
	monthAnchor: s.month_anchor,
	monthTotalCalls: s.month_total_calls,
	monthWins: s.month_wins,
	updatedAtMs: s.updated_at_ms
});

/**
 * Single-affiliation lookup. Returns `undefined` when the
 * affiliation has no stats doc yet (no member of it has had any
 * resolved trades). Callers should render as "unranked / no data".
 */
export const getAffiliationStats = async ({
	kind,
	affiliationId
}: {
	kind: AffiliationKind;
	affiliationId: string;
}): Promise<AffiliationStatsDoc | undefined> => {
	const { stats } = await functions.getAffiliationStats({ kind, affiliationId });

	return stats === undefined ? undefined : projectStatsWire(stats);
};

/**
 * Ranked leaderboard view of every affiliation of a kind. Sorted
 * server-side by accuracy desc → totalCalls desc → affiliationId asc.
 * Affiliations below `MIN_CALLS_FOR_RANK` are filtered out by the
 * aggregator.
 */
export const listAffiliationStats = async ({
	kind,
	limit
}: {
	kind: AffiliationKind;
	limit?: number;
}): Promise<AffiliationStatsDoc[]> => {
	const { items } = await functions.listAffiliationStats({ kind, limit });

	return items.map(projectStatsWire);
};

/**
 * Fire the Worlds podium claim for a closed month. Per backend
 * Proposal 2: the user calls this themselves (typically when
 * they first land on the Worlds surface in a new calendar
 * month), and the satellite credits VXP if their current
 * affiliation finished top-3 in the snapshot.
 *
 * Idempotent: a second call for the same month either reports
 * `awardsAlreadyClaimed > 0` or `notEligible === true`. Safe to
 * fire-and-forget on every Worlds load.
 *
 * Throws when `monthAnchor` is not a closed month (e.g. the
 * current calendar month) — callers should always pass a YYYY-MM
 * strictly before the current one.
 */
export const claimWorldsPodiumPrize = ({
	monthAnchor
}: {
	monthAnchor: string;
}): Promise<{
	monthAnchor: string;
	awardsCreated: number;
	awardsAlreadyClaimed: number;
	notEligible: boolean;
}> => functions.claimWorldsPodiumPrize({ monthAnchor });

/**
 * Compute the YYYY-MM anchor for the calendar month immediately
 * before the supplied timestamp's month (UTC). Convenience for the
 * "claim last month's podium on this month's first visit" pattern.
 */
export const previousMonthAnchor = (nowMs: number = Date.now()): string => {
	const d = new Date(nowMs);
	d.setUTCDate(1);
	d.setUTCHours(0, 0, 0, 0);
	d.setUTCMonth(d.getUTCMonth() - 1);

	return `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}`;
};
