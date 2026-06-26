# Spec: `resolved_results` — friend-readable per-participant resolution feed

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

Add a new satellite datastore collection, `resolved_results`, holding
**per-user, friend-readable** resolved-result rows — one row per
`(owner, market)` resolved call carrying that participant's outcome
(win/loss), side, and net VXP. The rows are written at resolution time
by the controllers-only resolution path and bulk-read friend-scoped by
the consumer (the Arena Friends digest, Spec B). This is a purely
additive backend collection: it has **no visible UI** on its own — the
rows are written and readable, but nothing renders them until Spec B
ships.

The collection exists because there is **no friend-readable
per-participant resolved-result source today**. Clearing trade-history
is exposed caller-scoped only (you can read your **own** per-call
settlements, not a friend's), and the single `ActivityType.SETTLEMENT`
activity row is the **resolver's market-level** result ("Market
Resolved: YES"), keyed by the resolver's principal — not a
per-participant outcome. So no existing surface — clearing
trade-history nor the `activities` stream — yields a friend-readable
per-call result. `resolved_results` is that source.

## Context

**Why this is split out of the Arena results digest.** This spec was
split from
[`2026-06-25-feat-arena-results-digest.md`](./2026-06-25-feat-arena-results-digest.md)
(Spec B) at the data-source / consumer boundary — see Decisions. Spec B
is the FE consumer (the Friends "Recent results" digest); this spec
(Spec A) is the additive backend it reads. Spec A is purely additive
backend with no FE coupling and **merges first**; Spec B depends on it.

**The data shape that does NOT carry what the consumer needs (the gap
this fills).**
[`src/lib/types/social.ts`](../../../../src/lib/types/social.ts)
`Activity` is `{ type, user, targetUser?, marketId?, title, details?,
timestamp }`. It carries the **call** as display text only — no
resolution outcome (win/loss) and no net VXP. The single
`ActivityType.SETTLEMENT`
([`src/lib/enums/social.ts`](../../../../src/lib/enums/social.ts)) row is
logged by the **resolver** (admin), keyed by the resolver's principal,
and says "Market Resolved: YES" with `details =
JSON.stringify({ outcome, price })`
([`src/lib/services/resolution.services.ts`](../../../../src/lib/services/resolution.services.ts)
`logActivity` call) — i.e. it describes the **market's** resolution, not
any individual friend's per-call result.

`ResolvedPosition`
([`src/lib/types/position.ts`](../../../../src/lib/types/position.ts):
`{ marketId, result: 'won' | 'lost' | 'neutral', realizedPnlUsd,
timestampNs, … }`) and its derived store
([`src/lib/derived/resolved-positions.derived.ts`](../../../../src/lib/derived/resolved-positions.derived.ts))
are assembled from the clearing trade-history events, which the
clearing canister exposes **caller-scoped only** — you can read your
**own** per-call settlements, not a friend's. Hence the new collection.

**The pattern to mirror — `activity_reaction_counts`.** The existing
`activity_reaction_counts` datastore collection is public-read /
controllers-write and is populated from inside a satellite hook using
`adminCaller()` + `setDocStore`. `resolved_results` mirrors that
shape exactly (see Security and the resolution-time write below), so
there is an established in-repo precedent for the controllers-write
discipline this spec relies on.

**Reuse (cite first — `docs/ai/frontend/reusability.md`).**

- The `activity_reaction_counts` collection wiring (in both
  [`juno.config.ts`](../../../../juno.config.ts) and the `Collection`
  enum in
  [`src/lib/constants/collections.constants.ts`](../../../../src/lib/constants/collections.constants.ts))
  and its `adminCaller()` + `setDocStore` controllers-write path — the
  template for `resolved_results`.
- The resolution/settlement path
  ([`src/lib/services/resolution.services.ts`](../../../../src/lib/services/resolution.services.ts):
  `settleMarket` → `settleSeriesApi` → `logActivity`) — the write
  trigger.
- The named time-window constants in
  [`src/lib/constants/app.constants.ts`](../../../../src/lib/constants/app.constants.ts)
  for the retention TTL (never a literal).

## Scope

**Backend / satellite only.** No FE rendering, no FE wiring beyond the
typed `Collection` enum entry that keeps the two declaration sites in
sync.

1. **The `resolved_results` collection.** A new Juno datastore
   collection, `memory: 'stable'`, `read: 'public'`, `write:
'controllers'`, snake_case plural — consistent with `activities` /
   `activity_reaction_counts` / `league_stats`. Doc shape, one per
   `(owner, market)` resolved call:

   ```
   { owner, marketId, title, side, outcome: 'win' | 'loss',
     netVxp /* USD_DECIMALS, signed */, resolvedAtMs }
   ```

   Key `${owner}#${marketId}` so a per-owner read is a bounded
   owner-prefix scan, never N+1.

2. **Collection wiring — two places, must stay in sync** (per
   `.claude/rules/juno.md` and `docs/ai/satellite/structure.md`):
   - [`juno.config.ts`](../../../../juno.config.ts) — add
     `RESOLVED_RESULTS = 'resolved_results'` to the
     `JunoDatastoreCollection` enum and a datastore entry
     `{ memory: 'stable', read: 'public', write: 'controllers' }`,
     mirroring the `activity_reaction_counts` entry.
   - [`src/lib/constants/collections.constants.ts`](../../../../src/lib/constants/collections.constants.ts)
     — add the matching `RESOLVED_RESULTS` member to the `Collection`
     object with a docstring (public read; controllers write — only the
     resolution path writes it).

3. **Resolution-time write.** Write one row per **participant per
   resolved market** at resolution, via the `adminCaller()` +
   `setDocStore` controllers-write pattern (mirror
   `activity_reaction_counts`). Which path writes it is a Pending
   decision (piggyback on the existing `SETTLEMENT` signal via a
   satellite hook, vs a dedicated controllers-only resolution endpoint
   — see Open questions and Pending decisions); the write itself is in
   scope either way.

4. **Friend-scoped bulk read.** A friend-scoped read that, given a set
   of friend principals, returns their resolved-result rows over the
   active window in **one** bounded `listDocs` over the friend set —
   **not** one call per friend. Owner-prefix keying keeps it a single
   batched read. This is the surface Spec B consumes.

5. **Retention / pruning.** A periodic controllers-only cleanup that
   prunes rows older than the digest's max `StandingsWindow` horizon,
   keyed on `resolvedAtMs`. The TTL is a named constant (Parameters),
   not a literal.

6. **Regenerate bindings.** Run `npm run juno:functions:build` and
   commit the regenerated `satellite.did` / `satellite_extension.did`
   / `api-schemas.ts`.

### Out of scope

- **All FE rendering / the digest UI** — the `FriendsTab.svelte`
  rewrite, the `FriendDigest` model, the standout-selection client
  logic, copy/i18n, the reaction, and the digest analytics all live in
  Spec B
  ([`2026-06-25-feat-arena-results-digest.md`](./2026-06-25-feat-arena-results-digest.md)).
- **The W–L / net-VXP aggregate** — that is the existing
  `getLeagueStandings` clearing query (no backend change) and is
  consumed directly by Spec B; it is not part of this collection.
- **Removing or altering the `activities` collection** — untouched; it
  still powers market "Recent trades", VXP onboarding counts, etc.
- **Any clearing / `../icdc-core/` change** — this lives entirely in the
  satellite, precisely to avoid the cross-repo path. No clearing `.did`
  regen is implied.

## Linked issues

No related open issue. Searched `AntonioVentilii/vici-app` open issues
for `resolved` / `results` / `collection` / `resolution outcome` /
`friends` / `arena` — the only open Arena issue is
[#970](https://github.com/AntonioVentilii/vici-app/issues/970)
("I see battles duplicated in Arena"), which concerns the Battles tab,
not this collection. No closing keyword.

## Analytics

**None.** This collection has no user-visible surface, so there is
nothing to instrument here — no event is emitted by the write path, the
read path, or the pruning. The digest-engagement analytics
(`friend_digest_opened`, the reused `friend_feed_reaction`) belong to
the consumer and live in Spec B.

## Technical requirements (satellite / backend — mandatory)

### Chosen design — `resolved_results` collection

A new Juno datastore collection holding **per-user, friend-readable**
resolved-result rows, written at resolution time, bulk-read
friend-scoped. Doc shape, one per `(owner, market)` resolved call:

```
{ owner, marketId, title, side, outcome: 'win' | 'loss',
  netVxp /* USD_DECIMALS, signed */, resolvedAtMs }
```

Key `${owner}#${marketId}` so the per-owner read is a bounded
owner-prefix scan, never N+1. (The consumer selects a per-friend
standout client-side from these rows by largest `|netVxp|`, tie-break
most recent `resolvedAtMs` — that selection rule is recorded here for
context but lives in Spec B.)

### Performance

- **Write frequency.** One `set_doc` per **participant per resolved
  market**, written at resolution. Resolution is a rare admin/solver
  action (the existing `SETTLEMENT` log notes "settlements are rare"),
  so this is a bounded fan-out, not a hot path. Instruction-budget
  impact on the resolution write path is O(participants in the market)
  extra `setDocStore` calls — bounded by market size, well under the IC
  instruction cap for a normal market; a pathologically large market is
  the scalability watch item below.
- **Read.** One bounded `listDocs` over the friend set per consumer
  hydration. Owner-prefix keying keeps it a single batched read, **not**
  one call per friend.

### Memory & storage

- New `stable` collection; one small doc per (resolved call,
  participant). Doc is a handful of scalar fields (~150–250 bytes).
- **Growth is unbounded** without a cap — it accrues a row for every
  participant of every resolved market, for all time. **Retention story
  (required):** prune rows older than the digest's max `StandingsWindow`
  horizon (the read never looks past the active window), via a periodic
  controllers-only cleanup keyed on `resolvedAtMs`. The exact TTL is a
  named constant (Parameters) and a Pending decision.

### Scalability

- At 10×/100× friends, the read stays one bulk owner-prefix scan; no
  N+1. At 10×/100× markets, the resolution-time fan-out grows with
  participants-per-market — if a single market's participant count can
  exceed the per-call instruction budget, the write must page across
  multiple resolution calls (Open questions: confirm max participants
  and whether resolution already batches).

### Upgrade & compatibility

- **Additive** — a new collection plus a write at the resolution path
  and a satellite read. Regenerate `satellite.did` /
  `satellite_extension.did` / `api-schemas.ts` via
  `npm run juno:functions:build` and commit. **Not breaking** (no `!`
  title / `BREAKING CHANGE:` block needed). No clearing `.did` regen is
  implied — this lives entirely in the satellite, not `../icdc-core/`,
  precisely to avoid the cross-repo path.

### Security

- **Public read, controllers write.** Only the resolution/controller
  path writes a result, so a user cannot forge a win for themselves or a
  friend. Mirror the `activity_reaction_counts` pattern: the write runs
  inside a satellite hook using `adminCaller()` + `setDocStore`, and the
  collection's `write: 'controllers'` rule rejects any client write at
  the Datastore boundary. Reads are public; in practice the consumer
  scopes them to the caller's friend set.

### Parameters

- The retention TTL is a named constant under
  [`src/lib/constants/`](../../../../src/lib/constants/) (the time
  windows live in `app.constants.ts`), never a literal — a copied
  horizon goes stale silently. The digest `StandingsWindow` that bounds
  the read window is owned by Spec B but constrains the TTL here (the
  cleanup horizon should not be shorter than the chosen digest window).

## Implementation outline

1. Add the `resolved_results` collection in `juno.config.ts` **and**
   `collections.constants.ts` — public-read / controllers-write,
   `memory: 'stable'`, mirroring `activity_reaction_counts`.
2. Write a row per participant at the resolution path via the
   `adminCaller()` + `setDocStore` controllers-write pattern (mirror
   `activity_reaction_counts`), keyed `${owner}#${marketId}`. Resolve
   the write-path piggyback decision (Pending decisions) first.
3. Add the friend-scoped bulk read — one bounded `listDocs` over the
   friend set, owner-prefix keyed, no N+1.
4. Add the periodic controllers-only retention cleanup keyed on
   `resolvedAtMs`, with the TTL as a named constant under
   `src/lib/constants/`.
5. Run `npm run juno:functions:build` and commit the regenerated
   `satellite.did` / `satellite_extension.did` / `api-schemas.ts`.
6. `npm run quality` + `npm run check` + `npm run juno:functions:build`.
7. Divergence check; flip status to `Implemented (#PR)`.

## Acceptance criteria

- [ ] The `resolved_results` collection is declared in **both**
      `juno.config.ts` and `collections.constants.ts`, is public-read /
      controllers-write, `memory: 'stable'`, and is written only by the
      resolution path.
- [ ] At resolution, one row per participant is written with the
      `{ owner, marketId, title, side, outcome, netVxp, resolvedAtMs }`
      shape, keyed `${owner}#${marketId}`, via the `adminCaller()` +
      `setDocStore` controllers-write pattern.
- [ ] A client write to the collection is rejected at the Datastore
      boundary (controllers-write rule), so a user cannot forge a result.
- [ ] The friend-scoped read returns a friend set's rows over the active
      window in **one** bounded `listDocs` (owner-prefix scan), not one
      call per friend.
- [ ] Rows older than the retention horizon are pruned by the periodic
      controllers-only cleanup keyed on `resolvedAtMs`; the TTL is a
      named constant under `src/lib/constants/`, not a literal.
- [ ] The collection has **no** user-visible surface in this PR (nothing
      renders the rows yet — that is Spec B).
- [ ] `npm run quality` and `npm run check` pass, plus
      `npm run juno:functions:build` with the regenerated `satellite.did`
      / `satellite_extension.did` / `api-schemas.ts` committed.

## Open questions

- **Does the resolution path expose the full participant set + per-user
  net VXP at write time?** The `resolved_results` write needs, per
  resolved market, every participant's `{ side, outcome, netVxp }`.
  Confirm the resolution/settlement path (`settleMarket` →
  `settleSeriesApi`, then the satellite write) can enumerate
  participants and their realized per-user net without a clearing
  round-trip — or whether it must read that back from clearing before
  writing the rows.
- **Maximum participants per market vs. the per-resolution instruction
  budget.** The write fan-out is O(participants); confirm the realistic
  max market size and whether resolution already batches, to size
  whether the write must page (Scalability).
- **Does any friend-readable `list_*_for(principal)`-style clearing read
  already exist** (`../icdc-core/`) that would let us skip this
  collection entirely? The chosen design assumes not; verify against the
  clearing Candid surface before building.
- **Which `StandingsWindow` bounds the read window and the TTL** —
  `'week'` vs `'month'` (vs `'all'`). This is owned by Spec B's digest
  window decision but constrains the retention horizon here; confirm the
  bound before sizing the TTL constant.

## Pending decisions

- **Which `StandingsWindow` bounds the read / retention** — `'week'` vs
  `'month'` (vs `'all'`). Owned by Spec B's digest-window decision; the
  TTL here should not be shorter than the chosen window. Recorded here
  because it sizes this collection's retention constant.
- **Retention / TTL for `resolved_results`.** The feed grows unbounded
  without a cap (Memory & storage). The cleanup horizon should not be
  shorter than the chosen digest window, but how much beyond it (e.g.
  exactly the window, or window + a grace margin) and the cleanup
  cadence are an owner/architecture call. Lands as a named constant
  under `src/lib/constants/`.
- **Where the `resolved_results` write piggybacks.** Settlement today is
  FE-initiated (`settleMarket` → `settleSeriesApi` → `logActivity`),
  **not** a satellite hook. Options: (a) write the rows from a satellite
  hook that fires on the existing `SETTLEMENT` activity set (reuses the
  resolution signal, controllers-write via `adminCaller()` like
  `activity_reaction_counts`); (b) add a dedicated controllers-only
  resolution endpoint the FE calls right after `settleSeriesApi`.
  Recommendation: (a) if the participant set + per-user net are
  derivable server-side at hook time (Open questions); else (b).
  Owner/architecture to confirm.

## Decisions

- **Split this collection out of the Arena results digest (owner,
  2026-06-25).** The `resolved_results` backend and the FriendsTab
  digest that consumes it were originally one spec
  ([`2026-06-25-feat-arena-results-digest.md`](./2026-06-25-feat-arena-results-digest.md)).
  The owner split it at the data-source / consumer boundary: this spec
  (A) is the purely additive backend with no FE coupling and merges
  first; Spec B is the FE consumer. The boundary is clean — A writes and
  exposes the rows, B is the only place they become visible. Per the
  workflow's
  [one-spec-one-PR rule](./../workflow.md#non-negotiables), spec'd work
  that cannot fit one reviewable PR is split at the spec level first.
- **Standout selection rule: largest |net VXP|, tie-break most recent
  (owner default, 2026-06-25).** Among a friend's resolved-result rows
  in the window, the consumer's standout is the call with the greatest
  absolute net VXP (their most consequential result, win or loss); ties
  break to the most recent `resolvedAtMs`. The selection runs in Spec B,
  but it is the reason this collection carries signed `netVxp` and
  `resolvedAtMs` per row — recorded here so the doc shape is justified.
