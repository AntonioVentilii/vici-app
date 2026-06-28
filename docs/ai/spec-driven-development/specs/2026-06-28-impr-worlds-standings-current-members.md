# Spec: Worlds standings reflect current opted-in members only

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

Make the Worlds Universities standings (Arena → Worlds → Schools)
reflect **only the current, opted-in roster** of each
school/country — on every window: all-time, current month, the
closed-month podium, and championship history. Today a member's
contribution is an append-only, forward-only aggregate that can never
be retracted: once you pump a school's numbers you can wait out the
90-day lock, leave, and the school keeps your wins/calls forever. The
fix removes the append-only aggregate entirely and derives every
standings window by recomputing over the affiliation's present
roster, so leaving (or opting out via `worldsOptIn`) instantly
subtracts a member's past contribution.

## Context

The Worlds standings have **two** contribution paths today, only one
of which is already correct:

- **All-time window — already roster-derived (PR #884).**
  `aggregateMembersLifetime` in
  [`cohort.services.ts`](../../../../src/satellite/services/cohort.services.ts)
  sums each _current_ member's profile lifetime (`totalTrades` +
  derived wins from `winRate`) per affiliation. `listAffiliationStatsFn`
  and `getAffiliationStatsFn` read all-time from it. Leaving already
  subtracts your lifetime here. **It does not yet honor `worldsOptIn`.**

- **Monthly / season window — append-only, the broken path.** The
  hook `onProfileSetForAffiliationStats` in
  [`affiliation-stats.services.ts`](../../../../src/satellite/services/affiliation-stats.services.ts)
  increments a shared `AFFILIATION_STATS` doc
  (`${kind}/${affiliationIdentifier}`) whenever a member's profile
  `totalTrades` advances, and freezes a write-once monthly
  **snapshot** (`${kind}/${affiliationIdentifier}/${monthAnchor}`) on
  lazy month rollover. `assertSetAffiliationStats` enforces
  forward-only counters (lifetime/month totals can never decrease;
  snapshots are write-once). These docs feed the monthly column of
  `listAffiliationStatsFn` / `getAffiliationStatsFn`, the closed-month
  podium (`listAffiliationStatsForMonthFn` →
  [`vxp-worlds-podium.services.ts`](../../../../src/satellite/services/vxp-worlds-podium.services.ts)),
  and championship history (`listAffiliationChampionshipsFn`). Nothing
  ever subtracts a member's monthly contribution: `assertDeleteAffiliation`
  deletes only the membership row after the lock.

**Resulting exploits** (all live against the monthly/podium/championship
surfaces; the all-time window is already immune post-#884):

1. Pump school A → wait out the 90-day lock → leave. A keeps your
   monthly + frozen-snapshot credit forever.
2. Sequentially pump A, leave; pump B, leave — every school retains
   the credit.
3. `worldsOptIn` (see below) can only gate _future_ contribution under
   the current model; it cannot subtract the past.

**The opt-out flag exists but is unenforced.** `worldsOptIn` lives on
`profile.preferences.sharing.worldsOptIn`
([`preferences.ts`](../../../../src/lib/types/preferences.ts), default
`true`, opt-out), surfaced in
[`SettingsPage.svelte`](../../../../src/lib/components/pages/SettingsPage.svelte).
Its doc comment states server-side enforcement is "a separate
follow-up." A sibling effort
(`feat-sharing-opt-out-enforcement`, tracked separately) covers the
**global leaderboard** opt-out; this spec owns the **Worlds**
opt-out, because the Worlds aggregation point is the only place that
can apply it.

**The reuse anchor that collapses the hard part.** The monthly podium
cannot move to live recompute over _profiles_, because profiles store
only lifetime totals — no per-month deltas. But the repo already has a
per-member-per-month store:
[`USER_MONTHLY_STATS`](../../../../src/lib/types/user-monthly-stats.ts)
holds one `${owner}/${YYYY-MM}` doc per user-month with
`{ monthCalls, monthWins, monthConsensus, updatedAtMs }`, written
client-side by `syncMyMonthlyStats`
([`user-monthly-stats.services.ts`](../../../../src/lib/services/user-monthly-stats.services.ts))
from the user's **real clearing history** on every
`calculateAndSyncStats` run, for the current **and** prior month, and
guarded by `assertSetUserMonthlyStats` (own-row, structural sanity).
This is exactly the per-member-per-month delta the monthly Worlds
window needs. It already exists and is already populated — the monthly
window can be recomputed from it the same way `aggregateMembersLifetime`
recomputes all-time from profiles.

Relevant constants (cite, don't restate — see
[vxp-economy.constants.ts](../../../../src/lib/constants/vxp-economy.constants.ts)
and [affiliation-stats.ts](../../../../src/lib/types/affiliation-stats.ts)):
`VXP_WORLDS_PODIUM` (400/200/100), `MIN_CALLS_FOR_RANK` (affiliation
depth floor), `AFFILIATION_LOCK_MS` (90d), `MONTHLY_MIN_CALLS` (per-user
floor on `USER_MONTHLY_STATS`).

Endpoints affected, all registered in
[`satellite/index.ts`](../../../../src/satellite/index.ts):
`getAffiliationStats`, `listAffiliationStats`,
`listAffiliationStatsForMonth`, `listAffiliationChampionships`,
`claimWorldsPodiumPrize`.

## Scope

Replace the append-only monthly path with roster-recompute, and apply
the `worldsOptIn` opt-out at every Worlds aggregation point. **The
wire shapes of all affected endpoints are unchanged** — only the
internal data source changes — so there is no `.did`/bindings regen
(see Technical requirements → Upgrade).

1. **New monthly aggregator** in `cohort.services.ts`:
   `aggregateMembersForMonth({ kind, monthAnchor, affiliationIdentifier? })`,
   the monthly mirror of `aggregateMembersLifetime`. It buckets, per
   affiliation, the sum of each **current, opted-in** member's
   `USER_MONTHLY_STATS[${member}/${monthAnchor}]` `monthCalls` /
   `monthWins`.

2. **Opt-out filter** applied in **both** aggregators: a member whose
   decoded profile has `preferences.sharing.worldsOptIn === false` is
   excluded from every bucket (all-time and monthly). Missing/legacy
   profiles default to included (opt-out defaults to `true` = shown).

3. **Re-source the monthly column** of `listAffiliationStatsFn`,
   `getAffiliationStatsFn`, `listAffiliationStatsForMonthFn`, and
   `listAffiliationChampionshipsFn` from `aggregateMembersForMonth`
   instead of the `AFFILIATION_STATS` rolling/snapshot docs. Ranking,
   tie-break (`compareAffiliationRank`), and the `MIN_CALLS_FOR_RANK`
   depth floor are unchanged — they now rank recomputed rows.

4. **Podium claim** (`claimWorldsPodiumPrizeFn`) keeps reading
   `listAffiliationStatsForMonthFn` for the top-3; because that now
   recomputes over the current opted-in roster, a member who has left
   (or opted out) no longer counts toward, and can no longer claim
   for, that month. The award doc remains write-once / idempotent.

5. **Delete the append-only writers:** remove
   `onProfileSetForAffiliationStats` and `assertSetAffiliationStats`
   and their registration in `satellite/index.ts`. After this, nothing
   reads or writes `AFFILIATION_STATS`.

6. **Apply the opt-out to the existing all-time path** (item 2 covers
   the filter; this closes the gap that #884 left open).

### Out of scope

- **Removing the `AFFILIATION_STATS` collection** from
  [`juno.config.ts`](../../../../juno.config.ts) and
  [`collections.constants.ts`](../../../../src/lib/constants/collections.constants.ts).
  Dropping a collection is a destructive schema change; this PR leaves
  it declared-but-unused (no reads, no writes) and a follow-up chore PR
  removes it. Keeping it avoids a migration in this PR and keeps the
  change bindings-neutral.
- **Server-side re-verification of `USER_MONTHLY_STATS` against
  clearing history** (see Security + Pending decisions).
- **The global-leaderboard `worldsOptIn`/`leaderboardOptIn`
  enforcement** — owned by `feat-sharing-opt-out-enforcement`. This
  spec only enforces `worldsOptIn` on Worlds surfaces.
- **Backfilling historical months** that predate `USER_MONTHLY_STATS`
  population (see Pending decisions).

## Linked issues

No open issue tracks this exploit in the repository at authoring time;
search of open issues found none for "worlds", "affiliation", or
"leaderboard retraction". If one is filed before the PR opens, link it
as `Closes #N` in the PR body (no em-dash after the number). This spec
is the originating record otherwise.

## Analytics

The change is a server-side integrity rework with no new user-facing
surface, so it warrants **no new analytics events**. The two relevant
user actions are already instrumented:
`affiliation_removed` (a leave — the moment contribution is retracted)
and `affiliation_set`, both in
[`analytics-event.ts`](../../../../src/lib/types/analytics-event.ts).
The `worldsOptIn` toggle lives in Settings; if the sibling opt-out
spec adds a privacy-toggle event, this spec does not duplicate it.
No event is added here; the existing pair already captures the
behaviour that drives a roster change.

## Technical requirements (satellite / backend — mandatory)

**Performance.**

- _Hook removal is a net win._ `onProfileSetForAffiliationStats` fires
  on **every** profile write and today does one `AFFILIATION_STATS`-
  adjacent `listDocsStore(AFFILIATIONS)` scan + up to 2 `getDocStore`
  - up to 4 `setDocStore` under the **update** instruction budget.
    Deleting it removes that cost from the hot profile-write path.
    `USER_MONTHLY_STATS` writes already happen independently in
    `syncMyMonthlyStats`, so no write cost moves elsewhere.
- _Reads move to query budget._ The new aggregator runs inside
  read-only `defineQuery` endpoints (IC query instruction ceiling,
  ~5B, far above the update ceiling). Cost per monthly leaderboard
  read: one `listDocsStore(AFFILIATIONS)` scan + one
  `listDocsStore(USER_MONTHLY_STATS)` scan (filtered by `/${anchor}`
  suffix, the same shape `getMonthlyLeaderboardFn` already uses) +
  one `getDocStore(PROFILES)` per member of the kind for the opt-out
  read. This matches the established cost of the all-time path
  (`aggregateMembersLifetime` already reads one profile per member);
  the monthly path adds a single collection scan, not an extra
  per-member round-trip.

**Memory & storage.**

- _Net reduction._ No new collection. `USER_MONTHLY_STATS` already
  exists and is already written; this spec only _reads_ it. The
  `AFFILIATION_STATS` collection stops growing (no more rolling
  increments, no more monthly snapshot docs); its existing docs become
  dead data, reclaimed when the follow-up chore drops the collection.
- _Growth._ `USER_MONTHLY_STATS` grows at one doc per active user per
  month they trade (`syncMyMonthlyStats` skips empty months). At 10k
  active monthly users that is ~10k docs/month; unchanged by this spec
  since the FE already writes them. Retention of old user-months ties
  to the closed-month-podium decision (see Pending decisions).

**Scalability.**

- The aggregators are O(roster) per kind: bounded by total affiliated
  members, not by markets. At 10×/100× membership the per-read cost
  scales linearly — identical to the already-shipped all-time path.
- Two full collection scans per monthly read (`AFFILIATIONS` +
  `USER_MONTHLY_STATS`) are the dominant term. If membership grows
  past the point where a per-read full scan is too costly, the
  optimization is a reverse-index `affiliationIdentifier → members`
  doc; out of scope here (the all-time path accepts the same scan
  today). Note any such cap explicitly rather than silently sampling.

**Upgrade & compatibility.**

- **Bindings-neutral, non-breaking.** Every affected endpoint keeps
  its current request/response schema
  (`AffiliationStatsWireSchema` et al.) — only the handler's data
  source changes — so **no `npm run did` / `juno:functions:build`
  regen is required**. No `.did` change, no `BREAKING CHANGE:` block,
  no `!` title.
- Removing the two hook/assert functions changes only
  `satellite/index.ts` wiring (still a satellite wasm rebuild +
  `juno:functions:build` for the functions bundle, but no Candid
  surface change).
- The deferred collection drop (Out of scope) _will_ be a schema
  change in its follow-up PR.

**Security.**

- _Collection rules._ No rule changes. `assertSetAffiliationStats` is
  deleted along with all writes to `AFFILIATION_STATS`.
  `assertSetUserMonthlyStats` (own-row, structural sanity) already
  governs the only collection now feeding the monthly window.
- _New trust surface — the central risk._ The podium pays VXP
  (`VXP_WORLDS_PODIUM`). Moving the podium ranking onto
  `USER_MONTHLY_STATS` means an affiliation's monthly standing is
  derived from member-written docs. Those docs are derived from the
  clearing canister's settled events (`syncMyMonthlyStats` buckets
  real history), but `assertSetUserMonthlyStats` does **not**
  re-verify the counters against clearing — a tampered client could
  inflate its own `monthCalls`/`monthWins` to push its affiliation
  onto the podium and trigger payouts to its members. The pre-existing
  monthly path had the same root weakness (the hook trusted the
  profile's self-reported `totalTrades`/`winRate`), so this is not a
  _new_ class of trust, but it now gates a VXP payout more directly.
  Mitigations available: the `MIN_CALLS_FOR_RANK` depth floor, the
  per-user `MONTHLY_MIN_CALLS` floor, and the bounded blast radius
  (inflating helps the _affiliation_, which still must out-rank
  others by accuracy). Full server-side re-derivation from the
  `RESOLVED_RESULTS` collection is the heavier fix — captured as a
  Pending decision, not built here.

**Parameters.** Reuse the existing constants cited in Context; add no
new tunables. The depth floor stays `MIN_CALLS_FOR_RANK`.

## Implementation outline

1. In `cohort.services.ts`, add `aggregateMembersForMonth`:
   - `listDocsStore(USER_MONTHLY_STATS)`, filter keys ending
     `/${monthAnchor}`, decode to a `Map<owner, {monthCalls,
monthWins}>` (mirror `getMonthlyLeaderboardFn`'s suffix scan).
   - `listDocsStore(AFFILIATIONS)`, filter to the kind (and optional
     `affiliationIdentifier`); for each member read their profile
     (`getDocStore(PROFILES, member)`), drop if
     `preferences.sharing.worldsOptIn === false`, else add their
     month bucket into the affiliation's `{totalCalls, wins}` (named
     to match the monthly accessors).
   - Return `Map<affiliationIdentifier, {monthCalls, monthWins}>`.
2. Add the same `worldsOptIn` profile check inside
   `aggregateMembersLifetime` (one decoded field on the profile it
   already reads — no extra read).
3. Re-source the monthly column:
   - `listAffiliationStatsFn`: replace the `AFFILIATION_STATS` rolling
     scan with `aggregateMembersForMonth({ kind, monthAnchor: anchor })`;
     keep the all-time lifetime as the ranking base, fill the monthly
     fields from the recompute.
   - `getAffiliationStatsFn`: fill `monthTotalCalls`/`monthWins` from
     `aggregateMembersForMonth({ kind, monthAnchor, affiliationIdentifier })`.
   - `listAffiliationStatsForMonthFn`: recompute the per-affiliation
     monthly rows from `aggregateMembersForMonth({ kind, monthAnchor })`,
     apply `MIN_CALLS_FOR_RANK`, sort with `compareAffiliationRank`
     (monthly accessors).
   - `listAffiliationChampionshipsFn`: derive each closed month's
     winner from `aggregateMembersForMonth` for that month (see
     Pending decisions on month enumeration).
4. Delete `onProfileSetForAffiliationStats` and
   `assertSetAffiliationStats`; remove their imports/registration in
   `satellite/index.ts`. Delete now-unused snapshot key helpers if no
   longer referenced (`affiliationStatsSnapshotKey`), keeping
   `affiliationStatsKey`/`monthAnchorFromMs` if still used.
5. `npm run juno:functions:build` (functions bundle rebuild — no
   Candid change expected; confirm the diff under
   `src/declarations/**` is empty), then `npm run quality` +
   `npm run check`.
6. Update [`PRODUCT.md`](../../PRODUCT.md): the Worlds standings now
   reflect the current opted-in roster on every window, and leaving or
   opting out retracts past contribution.

## Acceptance criteria

- [ ] A member who contributes to a school then leaves (after the
      lock) no longer appears in, or contributes to, that school's
      all-time, monthly, podium, or championship standing.
- [ ] Setting `worldsOptIn = false` removes the member's contribution
      from every Worlds standings window on the next read.
- [ ] The monthly Worlds column for affiliation X and month M equals
      the sum of `USER_MONTHLY_STATS[member/M]` over X's current
      opted-in roster, gated by `MIN_CALLS_FOR_RANK`.
- [ ] `claimWorldsPodiumPrize` awards only to current members of an
      affiliation that ranks top-3 under the recomputed month; a left
      or opted-out member is rejected as not eligible; already-paid
      award docs remain write-once/idempotent.
- [ ] `onProfileSetForAffiliationStats` and `assertSetAffiliationStats`
      are deleted; nothing writes `AFFILIATION_STATS`; a profile write
      no longer touches that collection.
- [ ] No `.did`/bindings change: `src/declarations/**` is unchanged
      after `juno:functions:build`.
- [ ] `npm run quality` and `npm run check` pass.

## Open questions

- Does `USER_MONTHLY_STATS` have sufficient coverage for the _current_
  closed-month podium claim window? `syncMyMonthlyStats` writes the
  current + prior month on every sync, so an honest user who syncs in
  the first days of month N+1 has month N populated. Confirm that the
  FE podium-claim flow triggers a sync before claiming (so a returning
  user's prior-month doc exists at claim time), or that the typical
  monthly sync cadence makes this reliable.

## Pending decisions

- **Closed-month ranking: fully live vs frozen-at-close.** Recomputing
  a closed month over the _current_ roster means its ranking can drift
  after the month ends as members join/leave/opt-out, while podium
  award docs are write-once (no clawback) — so two claimers of the
  same month could receive placements computed against slightly
  different rosters. Options: **(a)** fully live recompute everywhere
  (recommended — leaving always retracts, including retroactively for
  the displayed board and championship cups; the write-once award
  bounds the only inconsistency to "already-paid stays paid"); **(b)**
  freeze a per-month ranking snapshot at first rollover/claim computed
  over the then-current opted-in roster (stable awards/cups, but a
  post-close leave no longer retracts that one closed month — note the
  90-day lock means most pump-then-leave spans multiple months
  anyway). Owner: product. This is the hard trade-off the monthly
  podium forces; resolve before flipping to In progress.
- **Championship history without snapshot docs.** With
  `AFFILIATION_STATS` snapshots gone, `listAffiliationChampionships`
  has no list of "which months closed." Option (a): enumerate the
  distinct month anchors present in `USER_MONTHLY_STATS` and recompute
  each (live, mutable history). Option (b): keep a lightweight
  immutable per-month champion record. Tied to the decision above.
- **Pre-`USER_MONTHLY_STATS` historical months.** Months that closed
  before `USER_MONTHLY_STATS` was populated will show reduced/no
  monthly data under recompute (those affiliations' old snapshots are
  abandoned). Accept as historical (those podiums are long claimed),
  or one-time backfill? Recommend accept — no backfill.
- **Server-side verification of monthly counters against
  `RESOLVED_RESULTS`.** Given the podium pays VXP, decide whether to
  re-derive `monthCalls`/`monthWins` server-side rather than trust the
  member-written doc. Heavier; recommend deferring to a follow-up and
  shipping with the existing floors as mitigation.

## Decisions

- **Reuse `USER_MONTHLY_STATS` rather than introduce a per-affiliation
  contribution ledger.** A new ledger that the leave/opt-out path
  actively decrements was considered and rejected: it fights the
  existing write-once/forward-only invariants (you would have to
  mutate frozen snapshots to subtract), adds a collection, and needs a
  migration for baked-in totals. `USER_MONTHLY_STATS` already holds
  the per-member-per-month deltas, derived from real clearing history,
  with an own-row assert — so read-time roster-recompute (the same
  shape #884 used for all-time) closes the exploit with no new storage
  and no bindings change.
- **Aggregate at read time, delete the write-time hook.** Moving all
  windows to read-time recompute is what makes retraction automatic
  (leave = not in the roster scan; opt-out = filtered) and removes the
  append-only writer that caused the bug.
