# Spec: Arena Friends — "Recent results" per-friend digest

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

Replace the Arena → Friends "Recent activity" firehose — one row per
individual friend call ("@alice called YES on …") — with a per-friend
"Recent results" digest. Each row summarises **one friend's** resolved
record over a recent window: their win–loss tally, their net VXP, the
standout market they called, and a relative time window ("2h ago" /
"today"), with the existing `Zap` reaction kept. Open / unresolved calls
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
  NOT available for a friend.** `ResolvedPosition`
  ([`src/lib/types/position.ts`](../../../../src/lib/types/position.ts):
  `{ marketId, result: 'won' | 'lost' | 'neutral', realizedPnlUsd,
timestampNs, … }`) and its derived store
  ([`src/lib/derived/resolved-positions.derived.ts`](../../../../src/lib/derived/resolved-positions.derived.ts))
  are assembled from the clearing trade-history events, which the
  clearing canister exposes **caller-scoped only** — you can read your
  **own** per-call settlements, not a friend's. There is no satellite
  collection mirroring per-call resolved positions for other principals.
  So "the standout market" — the prototype's `highlight` market id —
  has **no friend-scoped data source today**. This is the headline open
  question, sized below.

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

Frontend-only **if** the digest is built on the existing
`getLeagueStandings` aggregate and the standout-market line is deferred
(the recommended v1 — see Pending decisions). The "Technical
requirements" section below is included because the standout-market line,
**if pursued in this spec**, needs a satellite/clearing data source; if
the owner defers it (recommended), that section's satellite work drops
out and this becomes a pure-frontend change.

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
   - `standoutMarketId` — populated only if the standout-market source
     lands in this spec; otherwise omitted and the "incl. …" line is not
     rendered (degrade to W–L + net only).
2. **Fetch the friend-scoped standings slice.** Add a hydration call (in
   `onMount`, alongside the existing all-time fetch) that requests
   `getLeagueStandings({ window: <chosen>, members: [...friendIds] })`
   into a store, or reuse `globalStandingsStore` for the matching window.
   One bulk call for the whole friend set — no per-friend N+1.
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
- **A new per-call resolved-position feed for friends** (one row per
  resolved call, with the exact per-call VXP) — this is the firehose in
  a different coat and needs the friend-scoped per-call source that does
  not exist (Open questions). The digest is deliberately an aggregate.
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

This section applies **only if** the standout-market line (per-call,
friend-scoped resolution data) is pursued **in this spec**. The
recommended v1 (Pending decisions) defers it and ships frontend-only on
the existing `getLeagueStandings` aggregate — in which case **no
satellite change is introduced** (the W–L / net-VXP slice is an existing
clearing query) and this section is satisfied by "no backend change".

If the standout market is pursued, the friend-scoped per-call source has
to be created, because clearing trade-history is caller-scoped. The two
candidate shapes and their numbers:

- **Option A — denormalize a per-call result into the existing
  settlement signal.** Extend the per-user settlement record so a
  friend-readable doc carries `{ owner, marketId, result, realizedVxp,
resolvedAtMs }` per resolved call, written at resolution time into a
  new public-read collection (one doc per `(owner, market)`).
  - **Performance.** One extra `set_doc` per user-per-resolved-market at
    resolution (resolution is a rare admin action — see
    `getSettlementActivities`' "settlements are rare" note); the digest
    read is one bounded `listDocs` per friend or a key-prefix batch, not
    N+1 if keyed `${owner}#${marketId}` and read by owner prefix.
  - **Memory & storage.** New `stable` collection; one small doc per
    (resolved call, participant). Growth = lifetime resolved positions
    across all users — the largest of the candidate footprints; needs a
    retention/cleanup story (e.g. prune beyond the digest's max window).
  - **Scalability.** At 10×/100× users the resolution-time fan-out is
    O(participants per market); pagination/bulk read by owner prefix
    keeps the digest read bounded.
  - **Upgrade & compatibility.** Additive collection + the resolver
    write path; regenerate `satellite.did` / `satellite_extension.did` /
    `api-schemas.ts` via `npm run juno:functions:build` and commit. Not
    breaking.
  - **Security.** Public-read; **controllers-write** (only the resolver/
    admin writes a result, so a user cannot forge a win). Mirror the
    `assert` / controllers-write pattern from
    `activity_reaction_counts`.
  - **Parameters.** The digest window + any retention horizon are named
    constants under `src/lib/constants/`, not literals.
- **Option B — expose a friend-readable per-call query on clearing
  (`../icdc-core/`).** A `list_resolved_positions_for(principal, window)`
  read on the clearing canister. This is a **cross-repo** change
  (`../icdc-core/` has its own `AGENTS.md`; the binding is regenerated
  here via `npm run did` in a **separate** follow-up PR — see
  `docs/ai/pr-and-ci.md#9`). It keeps storage at zero new satellite cost
  but is the heavier, two-repo path and almost certainly does not fit
  this one PR.

Both options exceed a single reviewable Friends-tab PR, which is the
core reason the recommended v1 ships the aggregate digest without the
standout market and tracks the per-call source as a fast-follow spec.

## Implementation outline

1. Define `FriendDigest` (co-located in `FriendsTab.svelte` or a small
   `src/lib/types/social.ts` addition) = `{ friendId, profile, won,
lost, netVxp, windowLabel, standoutMarketId? }`.
2. In `FriendsTab.svelte`, add a `friendDigests` `$derived.by` that, for
   each `rankedFriends` entry, reads its `StandingEntry` from the chosen
   window's `globalStandingsStore` slice (or a dedicated friend-scoped
   store), maps `winCount` → `won`, `settledCount - winCount` → `lost`,
   `realizedPnl` → `netVxp` (via `formatVxpBalance`), and drops rows with
   `settledCount === 0`. Sort newest-result-first per the chosen window
   timestamp rule.
3. Add the friend-scoped standings hydration in `onMount` (alongside the
   existing all-time fetch) — `getLeagueStandings({ window, members:
[...friendIdSet] })` into the store; guard with the same cache-miss
   pattern already used for the all-time slice so a tab re-mount doesn't
   re-drain.
4. Replace the feed-section template (≈ lines 1149–1237): render
   `friendDigests` with the result line, window meta line, signed
   net-VXP, and the `Zap` reaction; wire row tap to `goToMarket(
standoutMarketId)` when present (else per the row-tap decision).
   Remove the `$globalActivities`-based `friendActivities` and its
   imports if nothing else in the component uses them.
5. Repoint `arena.friends.feed.eyebrow` to "Recent results" and update
   the empty-state strings (`arena.friends.feed.empty_a/_b`) across all
   locale catalogs under `src/lib/constants/messages/`; add any new keys
   (e.g. the `W–L` / "resolved N calls" templates) to every catalog.
   Run `npm run check:i18n`.
6. Resolve the reaction-identity decision and adjust the reaction
   wiring accordingly (keep `friend_feed_reaction`); add
   `friend_digest_opened` to the analytics TS union **and** Zod mirror,
   and `track` it on row tap.
7. **(Only if standout market is in-spec)** add the chosen backend source
   (Technical requirements), run `npm run juno:functions:build`, and
   commit regenerated artifacts.
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
- [ ] `npm run quality` and `npm run check` pass (plus
      `npm run juno:functions:build` with committed regenerated files
      **iff** the satellite was touched).

## Open questions

- **Is there any friend-scoped per-call resolution source the codebase
  exposes that the investigation missed?** Confirmed today: clearing
  trade-history (the basis of `ResolvedPosition`) is **caller-scoped**,
  and the `SETTLEMENT` activity is the resolver's market-level row, not a
  per-participant result — so the prototype's `highlight` standout market
  has no friend-readable source without one of the Technical-requirements
  options. Verify against `../icdc-core/`'s clearing Candid surface that
  no `list_*_for(principal)`-style read already exists before assuming a
  new one is required.
- **Does `getLeagueStandings` carry a usable per-entry "last resolved at"
  timestamp, or only the window-aggregate?** The standings aggregate has
  no single instant for the window-label / sort. Verify whether a
  `StandingEntry` (or the underlying `list_leaderboard` row) exposes a
  last-activity timestamp; if not, the window label must derive from the
  window bucket itself (Pending decisions) rather than a per-friend
  instant.

## Pending decisions

- **Standout market in v1, or fast-follow?** _(Recommended: fast-follow.)_
  The prototype's "incl. '<market>'" line needs friend-scoped per-call
  data that does not exist today; building it pulls in a satellite
  collection or a cross-repo clearing query (Technical requirements) and
  blows past one reviewable PR. Recommendation: ship the aggregate digest
  (W–L + net VXP + window) now, omit the standout line, and track the
  per-call source as its own spec. Owner to confirm the cut.
- **Which `StandingsWindow` backs the digest** — `'week'` vs `'month'`
  (vs `'all'`). "Recent results" implies the tightest meaningful bucket
  (`'week'`); `'month'` yields fuller rows on a thin friend graph. This
  also sets what the window label can say ("this week" vs a per-friend
  "2h ago", the latter only possible if a per-entry timestamp exists —
  see Open questions).
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
- **Row-tap target.** With no standout market in v1, a row tap has no
  market to open. Options: open the friend mini-profile sheet (reuses
  `openFriendSheet`), or make the row non-interactive. This also
  determines whether `friend_digest_opened` is meaningful (drop the event
  if the row is non-navigating).

## Decisions

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
  is intentionally one summarised row per friend (W–L + net VXP), not a
  per-resolved-call list — the latter would reintroduce the firehose the
  port set out to remove and would require the friend-scoped per-call
  source the codebase lacks. The aggregate is buildable today from
  `getLeagueStandings`.
