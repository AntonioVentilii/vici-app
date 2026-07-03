# Spec: Registered-accounts count for the cockpit warehouse

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: In progress

## Goal

The private `vici-cockpit` warehouse can read the **all-time registered-accounts
count** from the satellite. The cockpit's Acquisition surface measures every
active/dormant rate against a Registered denominator, but its event capture
only began 2026-07-02 — `account_created` events can never reconstruct the
pre-capture base. The satellite already holds the truth: `profiles` is
bootstrapped for every principal on first sign-in (`ensureProfile`), so its
collection length IS the registered figure.

## Design

- One admin-gated `defineQuery`, `getAnalyticsUserStats() -> { registered }`,
  in `src/satellite/services/analytics.services.ts`, wired in
  `src/satellite/index.ts` under the existing "Product analytics (cockpit
  DQ-1)" section (candid: `app_get_analytics_user_stats`).
- Same `isAdmin` gate as `getAnalyticsEvents` / `deleteAnalyticsEvents` — the
  cockpit's reader principal is the only expected caller.
- `countCollectionDocsStore({ collection: PROFILES })` — a collection **length**
  read, never a listing, so unlike `listDocsStore` it has no IC0522 exposure
  and stays O(1)-cheap as the user base grows.
- A count is the ONLY thing exported: no principals, no profile fields, no PII
  — consistent with the analytics privacy posture (pseudonymous principal is
  the only identity that ever leaves via the events export; here not even that).

## Non-goals

- No per-cohort or time-bucketed breakdowns (signup dates already flow through
  `account_created` events going forward).
- No backfill of historical signup _dates_ — the count is a present-time
  snapshot; the cockpit polls and stores its own time series.

## Acceptance criteria

- Non-admin callers are rejected.
- The cockpit reader principal receives `{ registered: <profiles length> }`.
- `juno functions build` regenerates the candid with the new query.
