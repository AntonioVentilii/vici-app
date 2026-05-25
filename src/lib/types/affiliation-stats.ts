import type { AffiliationKind } from '$lib/types/affiliation';

/**
 * Per-affiliation rolling stats. One doc per `(kind, affiliationId)`
 * pair under the `AFFILIATION_STATS` collection, keyed
 * `${kind}/${affiliationId}`.
 *
 * The doc tracks two parallel counters:
 *
 *  - **Lifetime** (`totalCalls`, `wins`) — never resets. The "all-time"
 *    accuracy displayed on the per-affiliation detail page.
 *  - **Current month** (`monthTotalCalls`, `monthWins`) — anchored on
 *    `monthAnchor` (YYYY-MM). When the satellite hook fires and the
 *    current calendar month no longer matches `monthAnchor`, the doc
 *    is rolled over: monthly counters reset to 0 and `monthAnchor`
 *    advances. This lazy rollover avoids needing a separate scheduled
 *    job and is naturally idempotent.
 *
 * Featured-event-scoped counters (e.g. "WC bout accuracy") live in
 * separate docs keyed `${kind}/${affiliationId}/${featuredEventTag}`
 * — same collection, structurally distinct. The lifetime / monthly
 * fields on those docs have the same semantics, just filtered to the
 * event's tagged markets. (Implemented when the activity-level
 * featured-event-tag hook lands; first-launch ships the primary
 * `(kind, affId)` doc only.)
 *
 * Writes are gated by `assertSetAffiliationStats`: only the hook
 * (signing as the user whose profile just updated) can write, and
 * only against affiliations the caller is a member of.
 */
export interface AffiliationStatsDoc {
	/** External id — matches `AffiliationDoc.affiliationId`. */
	affiliationId: string;
	/** `university` | `country` — same enum as `AffiliationDoc.kind`. */
	kind: AffiliationKind;
	/** Lifetime resolved-call count across all members. */
	totalCalls: number;
	/** Lifetime correct calls (the lifetime numerator). */
	wins: number;
	/** YYYY-MM tag that anchors the monthly window. */
	monthAnchor: string;
	/** Resolved calls in the current `monthAnchor`. */
	monthTotalCalls: number;
	/** Correct calls in the current `monthAnchor`. */
	monthWins: number;
	/** Last hook-write timestamp (ms). */
	updatedAtMs: number;
}

/**
 * Canonical key builder for the **rolling** (current-month) doc.
 * One per `(kind, affiliationId)`. Mirrors the affiliations
 * collection's `${kind}/${affiliationId}` prefix scheme so a
 * prefix scan naturally groups schools vs countries.
 */
export const affiliationStatsKey = ({
	kind,
	affiliationId
}: {
	kind: AffiliationKind;
	affiliationId: string;
}): string => `${kind}/${affiliationId}`;

/**
 * Canonical key builder for the **frozen** historical snapshot doc.
 * The hook writes one of these at the moment a stats doc rolls over
 * to a new month, capturing the just-completed month's totals.
 * Worlds podium reads these snapshots to compute top-3 for an
 * already-closed month.
 *
 * Key shape `${kind}/${affiliationId}/${monthAnchor}` — three
 * segments vs the rolling doc's two. The assert distinguishes them
 * by slash count.
 */
export const affiliationStatsSnapshotKey = ({
	kind,
	affiliationId,
	monthAnchor
}: {
	kind: AffiliationKind;
	affiliationId: string;
	monthAnchor: string;
}): string => `${kind}/${affiliationId}/${monthAnchor}`;

/**
 * Minimum resolved-call count before an affiliation appears on the
 * ranked leaderboard. Below this, accuracy is too noisy to be
 * meaningful (a single-member school at 1/1 = 100% would otherwise
 * top the chart). Set per product decision (Proposal 1.2 in
 * `docs/backend-proposals/README.md`): low bar for the first launch
 * to keep the leaderboard populated as activity ramps.
 */
export const MIN_CALLS_FOR_RANK = 50;

/**
 * Produce the YYYY-MM anchor used by `monthAnchor`. Server-side this
 * is computed against the satellite's IC time; FE callers should
 * pass `Date.now()` (the hook never round-trips through the FE so
 * there's no clock-skew risk).
 */
export const monthAnchorFromMs = (ms: number): string => {
	const d = new Date(ms);
	const year = d.getUTCFullYear();
	const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');

	return `${year}-${month}`;
};
