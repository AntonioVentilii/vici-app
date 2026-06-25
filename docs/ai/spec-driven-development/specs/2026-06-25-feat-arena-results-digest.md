# Spec: Arena Friends — "Recent results" per-friend digest

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

Replace the Arena → Friends "Recent activity" firehose — one row per
individual friend call ("@alice called YES on …") — with a per-friend
"Recent results" digest. Each row summarises **one friend's** resolved
record over a recent window: their win–loss tally, their net VXP, the
**standout market** they called (their most notable resolved
prediction — in v1, see Decisions), and a relative time window
("2h ago" / "today"), with the existing `Zap` reaction kept. Open /
unresolved calls
carry no outcome, so they are excluded — that "did-something" noise is
exactly what the firehose surfaced and what users asked to lose. The
result reads as a quiet, skimmable scoreboard of how your friends are
actually doing, not a stream of every move they make.

## Context

**Prototype (source of truth).** The V1.8 handover ports this as
domain 5 (Arena / Social), shipped in the prototype as `V1.8.45`
("Arena: Friends default + results digest"). The relevant prototype
sources are `screens.jsx` `FriendsScreen` (the `feed = D.FRIENDS_DIGEST`
"Recent results" section, ~lines 3735–3774) and the `FRIENDS_DIGEST`
seed in `data.js` (~lines 239–245). Each prototype row carries
`{ handle, won, lost, net, when, highlight }` where `highlight` is a
market id — rendered as `@handle · resolved N calls · W–L`, a
`{when} · incl. "{standout market question}"` meta line, the signed
`net VXP`, and a reaction (the prototype uses a 👏 emoji — **not**
ported; see Decisions). The legacy per-call `FRIENDS_FEED` seed is kept
in the prototype only "for reference" and is unused.

**Friends-as-default-Arena-tab is already shipped** in the app and is
**out of scope** here — this spec only swaps the feed section's data
model and copy.

**App — the surface being changed.**
[`src/lib/components/arena/FriendsTab.svelte`](../../../../src/lib/components/arena/FriendsTab.svelte):

- The "Friends feed" section (template ≈ lines 1149–1237) renders the
  firehose: `friendActivities` (≈ lines 661–663) =
  `$globalActivities.filter((a) => friendIdSet.has(a.user)).slice(0, 20)`
  — individual `Activity` rows drawn from the cached global activity
  stream filtered to the friend set. Each row shows `activity.title`
  ("called YES on …") + an optional `activity.details` market line + the
  `Zap` reaction.
- Eyebrow copy is the i18n key `arena.friends.feed.eyebrow` ("Recent
  activity"); the empty state uses `arena.friends.feed.empty_a` /
  `arena.friends.feed.empty_b`; the reaction's a11y label is
  `arena.friends.feed.like`.
- The reaction machinery (`toggleLike`, optimistic `pendingLikes`,
  `firingKeys`, server like counts from `activityReactionsStore` /
  `activityReactionCountsStore`, the `friend_feed_reaction` analytics
  event) is keyed to a per-`Activity` doc identity
  (`activityReactionKey({ activity })` =
  `${user}#${timestamp}#${type}`). A digest row is **not** an `Activity`
  doc, so reactions cannot attach to a digest row unchanged — see
  Pending decisions.

**App — the data shape that does NOT carry what the digest needs.**
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
any individual friend's per-call result. So neither the global activity
stream nor a settlement activity yields per-friend W–L or net VXP.

**App — where per-friend resolution data DOES / could come from.**

- **Aggregate W–L + net VXP per friend, per window — available today.**
  [`src/lib/services/standings.services.ts`](../../../../src/lib/services/standings.services.ts)
  `getLeagueStandings({ window, members })` returns, per principal in
  `members`, a `StandingEntry`
  ([`src/lib/types/standings.ts`](../../../../src/lib/types/standings.ts)):
  `{ owner, rank, realizedPnl (net VXP, USD_DECIMALS), settledCount,
winCount, accuracy, … }`. `winCount` = W, `settledCount - winCount` =
  L, `realizedPnl` = net VXP. It is sourced from the clearing
  `list_leaderboard` query and accepts a `members` principal filter, so
  it can be scoped to the friend set in **one** bulk call. Window is one
  of the three fixed calendar buckets `'week' | 'month' | 'all'`
  (`StandingsWindow`) — **not** an arbitrary "last 48h" range.
  `FriendsTab` already hydrates the all-time slice via
  `loadGlobalStandings({ window: 'all' })` for the ranked list's live
  accuracy (≈ lines 155–159, `globalStandingsStore`), so the
  infrastructure is present.
- **Per-call breakdown (the standout market + an exact net per call) —
  NOT available for a friend today; v1 builds it.** `ResolvedPosition`
  ([`src/lib/types/position.ts`](../../../../src/lib/types/position.ts):
  `{ marketId, result: 'won' | 'lost' | 'neutral', realizedPnlUsd,
timestampNs, … }`) and its derived store
  ([`src/lib/derived/resolved-positions.derived.ts`](../../../../src/lib/derived/resolved-positions.derived.ts))
  are assembled from the clearing trade-history events, which the
  clearing canister exposes **caller-scoped only** — you can read your
  **own** per-call settlements, not a friend's. The single
  `ActivityType.SETTLEMENT` row is the **resolver's market-level**
  result ("Market Resolved: YES"), keyed by the resolver's principal —
  not a per-participant outcome. So no existing surface — clearing
  trade-history nor the `activities` stream — yields a friend-readable
  per-call result. The standout market therefore needs a **new
  friend-readable per-participant resolved-result source**, designed
  under Technical requirements and shipped in v1 (Decisions).

**Reuse (cite first — `docs/ai/frontend/reusability.md`).**

- `getLeagueStandings` + `StandingEntry` + `StandingsWindow` +
  `globalStandingsStore` — the per-friend W–L / net-VXP aggregate.
- `formatRelativeAgoFromNs({ timestampNs, locale })`
  ([`src/lib/utils/format.utils.ts`](../../../../src/lib/utils/format.utils.ts))
  for the "2h ago" / "today" window string (it already drives the
  current `feedRelative`).
- `formatVxpBalance({ value })`
  ([`src/lib/utils/playground-display.utils.ts`](../../../../src/lib/utils/playground-display.utils.ts))
  for the signed net-VXP label (already used for the YOU-row points).
- `Avatar`
  ([`src/lib/components/profile/Avatar.svelte`](../../../../src/lib/components/profile/Avatar.svelte))
  - the `profilesStore` cache for each friend's handle / avatar (the
    feed already reads both).
- The existing `.feed-row` / `.feed-react` / `.react-burst` markup +
  `Zap` glyph in `FriendsTab.svelte` — reused for the digest row's
  layout and reaction (pending the reaction-identity decision below).

## Scope

**Backend + frontend.** The aggregate W–L / net-VXP slice is built on the
existing `getLeagueStandings` clearing query (no backend change), but the
**standout market is in v1** (Decisions) and there is no friend-readable
per-participant resolved-result source today. So this spec adds a **new
satellite collection** holding per-user, friend-readable resolved-result
rows, written at resolution time and bulk-read friend-scoped for the
digest (designed under Technical requirements). Because that pulls in a
new collection + a resolution-time write + a satellite read + the FE
digest, the work likely exceeds one reviewable PR — see PR scope for the
split recommendation.

1. **Replace `friendActivities` with a per-friend digest model.** In
   `FriendsTab.svelte`, derive `friendDigests: FriendDigest[]` from the
   friend set + a standings slice rather than from `$globalActivities`.
   Each `FriendDigest` = `{ friendId, profile, won, lost, netVxp,
windowLabel, standoutMarketId? }`:
   - `won` / `lost` / `netVxp` from the friend's `StandingEntry`
     (`winCount`, `settledCount - winCount`, `realizedPnl`) in the
     chosen window.
   - Rows with `settledCount === 0` are dropped (no resolved result to
     report — the open-call exclusion).
   - `windowLabel` — see Pending decisions on what timestamp drives it
     (the standings aggregate has no single "last resolved at" instant).
   - `standout` (`{ marketId, title }`) — the friend's most notable
     resolved prediction in the window, selected by the **largest
     |net VXP|, tie-break most recent `resolvedAtMs`** rule (Decisions),
     read from the new resolved-results collection. Omitted only when the
     friend has no resolved-result rows in the window, in which case the
     "incl. …" line is not rendered.
2. **Fetch the friend-scoped standings slice + resolved-results.** Add
   hydration calls (in `onMount`, alongside the existing all-time fetch):
   - `getLeagueStandings({ window: <chosen>, members: [...friendIds] })`
     for the W–L / net-VXP aggregate — one bulk call, no per-friend N+1.
   - The new friend-scoped resolved-results bulk read (Technical
     requirements) for the standout market — one bounded `listDocs` over
     the friend set, **not** one call per friend. The standout is
     selected client-side per the largest-|net VXP| rule (Decisions).
3. **Rewrite the feed section template** (≈ lines 1149–1237) to render
   `friendDigests`: `@handle · resolved {total} {call|calls} · {W}–{L}`,
   a `{windowLabel}` meta line (plus `· incl. "{standout question}"`
   only when `standoutMarketId` is present), the signed `{netVxp} VXP`
   colored win/loss, and the reaction. Tapping the row navigates to the
   standout market when present (mirroring the current `goToMarket`),
   else is non-navigating (or navigates to the friend profile sheet —
   Pending decisions).
4. **Copy.** Repoint the eyebrow to a "Recent results" string and update
   the empty-state copy to describe results rather than calls. Keep the
   `arena.friends.feed.*` i18n namespace (see Decisions); add/retarget
   keys across **all** locale catalogs under
   `src/lib/constants/messages/` and run `npm run check:i18n`.
5. **Reaction.** Keep the `Zap` reaction visually. Resolve its persisted
   identity per Pending decisions (a digest row is not an `Activity`
   doc, so the current `activity_reactions`-keyed persistence does not
   map 1:1).
6. **Analytics.** Instrument digest engagement (see Analytics).

### Out of scope

- **Friends-as-default-Arena-tab** — already shipped; untouched.
- **The invite hero, pending/incoming requests, ranked list, global-rank
  link, and both bottom sheets** in `FriendsTab.svelte` — only the feed
  section changes.
- **A new per-call resolved-position _feed_ for friends** (one visible
  row per resolved call, the firehose in a different coat). The digest
  stays one aggregate row per friend. Note: v1 _does_ add a
  friend-readable resolved-result data source (Technical requirements),
  but it backs only the single standout line per friend — it is not
  rendered as a per-call stream.
- **Reviving the standalone global `ActivityFeed`** / `MarketRecentTrades`
  — those keep the `Activity` model; this spec does not touch them. The
  `Activity` / `activities` collection itself is **not** removed (it
  still powers market "Recent trades", VXP onboarding counts, etc.) —
  only the Friends tab stops reading it.
- **An arbitrary rolling window** (e.g. exactly "last 24h"). v1 uses one
  of the fixed `StandingsWindow` calendar buckets (Pending decisions).

## Linked issues

No related open issue. Searched `AntonioVentilii/vici-app` open issues
for `friends` / `arena` / `activity` / `feed` / `digest` / `results` /
`resolution outcome` — the only open Arena issue is
[#970](https://github.com/AntonioVentilii/vici-app/issues/970)
("I see battles duplicated in Arena"), which concerns the Battles tab,
not the Friends feed. No closing keyword.

## PR scope — recommend splitting the spec

With the standout market in v1, the work spans a new satellite collection,
a resolution-time write, a satellite friend-scoped read, and the FE
digest. That is more than one reviewable PR, and the workflow's
[one-spec-one-PR rule](../workflow.md#non-negotiables) says when spec'd
work cannot fit one reviewable PR, the **spec** is split first — each part
with its own status and PR.

**Recommendation: split this spec into two**, at the data-source / consumer
boundary:

- **Spec A — `resolved_results` backend.** The new collection (wired in
  both `juno.config.ts` and `collections.constants.ts`), the
  controllers-write at the resolution path, the friend-scoped bulk-read
  endpoint, the retention/cleanup, and the regenerated `satellite.did` /
  `satellite_extension.did` / `api-schemas.ts`. Ships and merges first;
  has no user-visible surface on its own (the rows are written and
  readable but nothing renders them yet).
- **Spec B — Friends "Recent results" digest (this spec).** The
  `FriendsTab.svelte` rewrite: the `FriendDigest` model, the
  `getLeagueStandings` aggregate, consumption of Spec A's resolved-results
  read for the standout, the copy/i18n, the reaction, and the analytics.
  Depends on Spec A being merged.

The split boundary is clean: Spec A is purely additive backend with no FE
coupling; Spec B is the FE consumer and the only place the digest becomes
visible. If the owner prefers to keep it as one PR despite the size, that
is a valid override of the prefer-split default — but the two-spec split
is the recommended path here.

## Analytics

Instrument — the feed is otherwise invisible to product analysis, and
"do friends engage with each other's _results_ more than the firehose?"
is the question this change exists to answer. Reuse the existing
`friend_feed_reaction` event for the reaction (its `label: 'like' |
'unlike'`, `source: 'arena'` vocabulary is unchanged) so the
reaction-engagement series stays continuous across the swap.

Add **one** new event for opening a digest row, mirroring the existing
social-event style:

- `friend_digest_opened` — fired when a digest row is tapped through to a
  market / profile. Props: `source: 'arena'` (bounded), and `marketId`
  when the tap targets the standout market (reuses the existing
  `marketId` dimension; omitted otherwise). Behavioural only — no W–L,
  net VXP, or handle is sent (those are per-user values bordering on
  PII-adjacent and add no analytical value here).

A new event name lands in **both** halves of the dual-source pair —
`src/lib/types/analytics-event.ts` (TS union) **and**
`src/lib/schema/analytics-event.schema.ts` (Zod mirror); svelte-check
only catches the union, an enum mismatch fails at runtime. Capture via
`track` in `src/lib/services/analytics.services.ts`. (If the owner
decides a row tap is non-navigating and carries no meaningful action,
drop `friend_digest_opened` and keep only the reused
`friend_feed_reaction` — recorded under Pending decisions.)

## Technical requirements (satellite / backend — mandatory)

The W–L / net-VXP aggregate is the existing `getLeagueStandings` clearing
query — **no backend change** for that half. The **standout market** is
the part that needs a new data source: clearing trade-history is
caller-scoped, and the `SETTLEMENT` activity is the resolver's
market-level row, so no friend-readable per-participant result exists
today. v1 adds one.

### Chosen design — `resolved_results` collection

A new Juno datastore collection holding **per-user, friend-readable**
resolved-result rows, written at resolution time, bulk-read friend-scoped
for the digest. Doc shape, one per `(owner, market)` resolved call:

```
{ owner, marketId, title, side, outcome: 'win' | 'loss',
  netVxp /* USD_DECIMALS, signed */, resolvedAtMs }
```

Key `${owner}#${marketId}` so the digest read is a bounded owner-prefix
scan, never N+1. The standout per friend is selected client-side from
these rows by **largest |netVxp|, tie-break most recent `resolvedAtMs`**
(Decisions).

**Collection wiring — two places, must stay in sync** (per
`.claude/rules/juno.md` and `docs/ai/satellite/structure.md`):

- [`juno.config.ts`](../../../../juno.config.ts) — add
  `RESOLVED_RESULTS = 'resolved_results'` to the `JunoDatastoreCollection`
  enum and a datastore entry `{ memory: 'stable', read: 'public', write:
'controllers' }`, mirroring the `activity_reaction_counts` entry.
- [`src/lib/constants/collections.constants.ts`](../../../../src/lib/constants/collections.constants.ts)
  — add the matching `RESOLVED_RESULTS` member to the `Collection` object
  with a docstring (public read; controllers write — only the resolution
  path writes it).

Snake_case, plural — consistent with `activities` /
`activity_reaction_counts` / `league_stats`.

### Performance

- **Write frequency.** One `set_doc` per **participant per resolved
  market**, written at resolution. Resolution is a rare admin/solver
  action (the existing `SETTLEMENT` log notes "settlements are rare"), so
  this is a bounded fan-out, not a hot path. Instruction-budget impact on
  the resolution write path is O(participants in the market) extra
  `setDocStore` calls — bounded by market size, well under the IC
  instruction cap for a normal market; a pathologically large market is
  the scalability watch item below.
- **Read.** One bounded `listDocs` over the friend set per Friends-tab
  hydration, guarded by the same cache-miss pattern as the existing
  all-time standings slice so a re-mount doesn't re-drain. Owner-prefix
  keying keeps it a single batched read, **not** one call per friend.

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

- At 10×/100× friends, the digest read stays one bulk owner-prefix scan;
  no N+1. At 10×/100× markets, the resolution-time fan-out grows with
  participants-per-market — if a single market's participant count can
  exceed the per-call instruction budget, the write must page across
  multiple resolution calls (Open questions: confirm max participants and
  whether resolution already batches).

### Upgrade & compatibility

- **Additive** — a new collection plus a write at the resolution path and
  a satellite read endpoint. Regenerate `satellite.did` /
  `satellite_extension.did` / `api-schemas.ts` via
  `npm run juno:functions:build` and commit. **Not breaking** (no `!`
  title / `BREAKING CHANGE:` block needed). No clearing `.did` regen is
  implied — this lives entirely in the satellite, not `../icdc-core/`,
  precisely to avoid the cross-repo path.

### Security

- **Public read, controllers write.** Only the resolution/controller path
  writes a result, so a user cannot forge a win for themselves or a
  friend. Mirror the `activity_reaction_counts` pattern: the write runs
  inside a satellite hook using `adminCaller()` + `setDocStore`, and the
  collection's `write: 'controllers'` rule rejects any client write at the
  Datastore boundary. Reads are public; in practice the FE scopes them to
  the caller's friend set.

### Parameters

- The digest `StandingsWindow` and the retention TTL are named constants
  under [`src/lib/constants/`](../../../../src/lib/constants/) (the time
  windows live in `app.constants.ts`), never literals — a copied horizon
  goes stale silently.

## Implementation outline

1. Define `FriendDigest` (co-located in `FriendsTab.svelte` or a small
   `src/lib/types/social.ts` addition) = `{ friendId, profile, won,
lost, netVxp, windowLabel, standout? }` where `standout` is
   `{ marketId, title }`.
2. In `FriendsTab.svelte`, add a `friendDigests` `$derived.by` that, for
   each `rankedFriends` entry, reads its `StandingEntry` from the chosen
   window's `globalStandingsStore` slice (or a dedicated friend-scoped
   store), maps `winCount` → `won`, `settledCount - winCount` → `lost`,
   `realizedPnl` → `netVxp` (via `formatVxpBalance`), and drops rows with
   `settledCount === 0`. Sort newest-result-first per the chosen window
   timestamp rule.
3. Add the friend-scoped hydration in `onMount` (alongside the existing
   all-time fetch): `getLeagueStandings({ window, members:
[...friendIdSet] })` for the aggregate **and** the new
   `resolved_results` friend-scoped bulk read for the standout; guard
   both with the same cache-miss pattern already used for the all-time
   slice so a tab re-mount doesn't re-drain. Select each friend's
   `standout` client-side (largest |netVxp|, tie-break most recent).
4. Replace the feed-section template (≈ lines 1149–1237): render
   `friendDigests` with the result line, window meta line, signed
   net-VXP, and the `Zap` reaction; wire row tap to
   `goToMarket(standout.marketId)` when present (else per the row-tap
   decision). Remove the `$globalActivities`-based `friendActivities` and
   its imports if nothing else in the component uses them.
5. Repoint `arena.friends.feed.eyebrow` to "Recent results" and update
   the empty-state strings (`arena.friends.feed.empty_a/_b`) across all
   locale catalogs under `src/lib/constants/messages/`; add any new keys
   (e.g. the `W–L` / "resolved N calls" templates) to every catalog.
   Run `npm run check:i18n`.
6. Resolve the reaction-identity decision and adjust the reaction
   wiring accordingly (keep `friend_feed_reaction`); add
   `friend_digest_opened` to the analytics TS union **and** Zod mirror,
   and `track` it on row tap.
7. Add the `resolved_results` collection (Technical requirements): wire
   it in `juno.config.ts` **and** `collections.constants.ts`; write a row
   per participant at the resolution path via the `adminCaller()` +
   `setDocStore` controllers-write pattern (mirror
   `activity_reaction_counts`); add the friend-scoped bulk read endpoint;
   run `npm run juno:functions:build` and commit regenerated artifacts.
8. `npm run quality` + `npm run check` (+ `npm run juno:functions:build`
   if the satellite was touched).
9. Divergence check; update `docs/ai/PRODUCT.md` (the Friends feed now
   describes results, not calls); flip status to `Implemented (#PR)`.

## Acceptance criteria

- [ ] The Arena → Friends feed section renders **one row per friend** who
      has at least one resolved prediction in the window, not one row per
      call.
- [ ] Each row shows the friend's W–L record and signed net VXP (win/loss
      colored), sourced from the friend's `StandingEntry`
      (`winCount` / `settledCount` / `realizedPnl`), with a relative
      window label.
- [ ] Friends with no resolved predictions in the window do not appear
      (open / unresolved calls are excluded).
- [ ] Each row with resolved results shows a standout "incl.
      '{market}'" line — the friend's resolved call in the window with
      the largest |net VXP| (tie-break most recent) — sourced from the
      new `resolved_results` collection.
- [ ] The `resolved_results` collection is declared in **both**
      `juno.config.ts` and `collections.constants.ts`, is public-read /
      controllers-write, and is written only by the resolution path.
- [ ] The eyebrow reads "Recent results" (not "Recent activity") and the
      empty state describes results; all strings route through `t(...)`
      and exist in every locale catalog (`npm run check:i18n` passes).
- [ ] The reaction is the `Zap` lucide glyph (no emoji), and toggling it
      still fires `friend_feed_reaction`.
- [ ] `friend_digest_opened` (if retained) fires on row tap and exists in
      both the analytics TS union and the Zod mirror.
- [ ] The `$globalActivities`-based per-call firehose is no longer
      rendered in the Friends tab; the `activities` collection and other
      surfaces that consume it are unaffected.
- [ ] `npm run quality` and `npm run check` pass, plus
      `npm run juno:functions:build` with the regenerated `satellite.did`
      / `satellite_extension.did` / `api-schemas.ts` committed (the
      satellite is touched by the new collection).

## Open questions

- **Does the resolution path expose the full participant set + per-user
  net VXP at write time?** The `resolved_results` write needs, per
  resolved market, every participant's `{ side, outcome, netVxp }`.
  Confirm the resolution/settlement path (`settleMarket` →
  `settleSeriesApi`, then the satellite write) can enumerate participants
  and their realized per-user net without a clearing round-trip — or
  whether it must read that back from clearing before writing the rows.
- **Maximum participants per market vs. the per-resolution instruction
  budget.** The write fan-out is O(participants); confirm the realistic
  max market size and whether resolution already batches, to size whether
  the write must page (Scalability).
- **Does any friend-readable `list_*_for(principal)`-style clearing read
  already exist** (`../icdc-core/`) that would let us skip the satellite
  collection entirely? The chosen design assumes not; verify against the
  clearing Candid surface before building.
- **Does `getLeagueStandings` carry a usable per-entry "last resolved at"
  timestamp, or only the window-aggregate?** The standings aggregate has
  no single instant for the window-label / sort. Verify whether a
  `StandingEntry` (or the underlying `list_leaderboard` row) exposes a
  last-activity timestamp; if not, the window label must derive from the
  window bucket itself (Pending decisions) rather than a per-friend
  instant.

## Pending decisions

- **Which `StandingsWindow` backs the digest** — `'week'` vs `'month'`
  (vs `'all'`). "Recent results" implies the tightest meaningful bucket
  (`'week'`); `'month'` yields fuller rows on a thin friend graph. This
  also bounds the `resolved_results` read window and the retention TTL
  below. (The per-friend "2h ago" label is now achievable from the
  standout's `resolvedAtMs`, independent of whether the standings
  aggregate carries a timestamp — see Open questions.)
- **Retention / TTL for `resolved_results`.** The feed grows unbounded
  without a cap (Memory & storage). The cleanup horizon should not be
  shorter than the chosen digest window, but how much beyond it (e.g.
  exactly the window, or window + a grace margin) and the cleanup cadence
  are an owner/architecture call. Lands as a named constant under
  `src/lib/constants/`.
- **Where the `resolved_results` write piggybacks.** Settlement today is
  FE-initiated (`settleMarket` → `settleSeriesApi` → `logActivity`),
  **not** a satellite hook. Options: (a) write the rows from a satellite
  hook that fires on the existing `SETTLEMENT` activity set (reuses the
  resolution signal, controllers-write via `adminCaller()` like
  `activity_reaction_counts`); (b) add a dedicated controllers-only
  resolution endpoint the FE calls right after `settleSeriesApi`.
  Recommendation: (a) if the participant set + per-user net are derivable
  server-side at hook time (Open questions); else (b). Owner/architecture
  to confirm.
- **Reaction persisted identity for a digest row.** A digest row is not
  an `Activity` doc, so the current `activity_reactions` key
  (`${user}#${timestamp}#${type}`) has nothing to bind to. Options: (a)
  keep the reaction **transient** on the digest row (visual `Zap` +
  motion only, no persistence) for v1 — smallest change, but drops the
  persisted-like behaviour on this surface; (b) define a digest-row
  reaction identity (e.g. `${friendId}#${window}`) and a parallel
  persistence path. Recommendation: (a) for v1, with (b) as a follow-up
  if friends-reacting-to-results proves worth persisting. Owner to
  decide.
- **Row-tap target when a friend has no standout** (no resolved-result
  row, e.g. dropped by retention). The common case taps through to the
  standout market via `goToMarket`. For a standout-less row, options:
  open the friend mini-profile sheet (reuses `openFriendSheet`), or make
  the row non-interactive. This also determines whether
  `friend_digest_opened` fires in that case.

## Decisions

- **Standout market in v1 — build the backend data source (owner,
  2026-06-25).** The spec previously recommended shipping the aggregate
  digest frontend-only and deferring the standout line, because no
  friend-readable per-participant resolved-result source exists. The
  owner accepts the backend work to ship the full digest now: a new
  `resolved_results` collection written at resolution time and bulk-read
  friend-scoped (Technical requirements). The "incl. '<market>'" line is
  part of v1, not a fast-follow.
- **Standout selection rule: largest |net VXP|, tie-break most recent
  (owner default, 2026-06-25).** Among a friend's resolved-result rows in
  the window, the standout is the call with the greatest absolute net VXP
  (their most consequential result, win or loss); ties break to the most
  recent `resolvedAtMs`. Chosen as the sensible default — surfaces the
  result a friend would most want to talk about — over alternatives
  (most recent, biggest win only).
- **Copy: "Recent activity" → "Recent results."** Handed down with the
  port. The eyebrow (`arena.friends.feed.eyebrow`) and the empty-state
  copy reframe the section from per-call activity to resolved results —
  matching the prototype's `V1.8.45` intent and the new aggregate model.
- **Keep the `Zap` reaction icon — no emoji.** The prototype renders a
  👏 emoji; the app standardises on lucide icons, and the Friends feed
  already uses `Zap`. The reaction glyph stays `Zap`, preserving the
  app's icon system and the existing reaction motion / a11y label.
- **Keep the app's `arena.friends.feed.*` i18n namespace.** The
  prototype's `fr.*` / scattered keys do not transfer; the existing
  catalog namespace is retained and its keys retargeted in place, per the
  house i18n rule.
- **Aggregate digest over a per-call firehose-in-disguise.** The digest
  is intentionally one summarised row per friend (W–L + net VXP + a
  single standout), not a per-resolved-call list — the latter would
  reintroduce the firehose the port set out to remove. The new
  `resolved_results` source backs only the one standout line per friend,
  not a per-call stream.
