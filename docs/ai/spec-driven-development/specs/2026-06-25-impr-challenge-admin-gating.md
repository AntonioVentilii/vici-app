# Spec: Challenge admin-gating — a league admin (not only the owner) can initiate and respond to battles

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

A league **admin** — not just the owner — can start a battle, accept or
decline an incoming challenge, and (during the proposal window) retract
one. Today the owner is the only principal who can run any of these,
even though the `LeagueMemberRole` model already carries a distinct
`'admin'` role for exactly this kind of delegated authority. Non-admins
(plain members) keep no challenge powers and now see an explicit reason
— "Only a league owner or admin can start a battle." — instead of an
unexplained absent CTA.

## Context

The prototype (source of truth, V1.8.48 — `CHANGELOG.md`) replaced its
"first member in the array" heuristic with real role gating via
`window.VICI_isLeagueAdmin(league, me)` (in
`proto/VICI-V1.8-Handover/app.jsx`), used by `CreateBoutModal`,
`LeagueDetailScreen`, and `LeagueBoutSection` so "the challenge CTA shows
only to admins; others see 'Only the league admin can start a battle.'"
(`proto/.../screens.jsx`, `LeagueBoutSection`). The prototype's data
model has a **single** `adminId` per league — effectively the owner — so
in proto terms "admin" and "owner" collapse. **The app's model is
richer**: `LeagueMemberRole = 'owner' | 'admin' | 'member'`
(`src/lib/types/league-member.ts`), with `owner` unique and `admin` a
day-2 delegated role. Porting the _behaviour_ here means letting the
app's `admin` role do what the proto's lone `adminId` did — initiate and
respond to battles — **in addition to** the owner.

Current app state (gates everything on `owner`):

- `src/lib/components/pages/LeagueDetailPage.svelte` —
  `canChallenge = myRole === 'owner'` (line ~159); `canRespondToBattle`,
  `canKickoffBattle` (lines ~658–668) gate on `myRole === 'owner'`; the
  deep-link `?challenge=1` effect (~138) and the `CreateBoutModal` /
  challenge-CTA render guards (~1497, ~1532, ~1597) all key off
  `canChallenge`. The `'admin'` role is rendered (the
  `leagues.detail.battle_admin_chip` "Admin · you" chip, the
  `LeagueRoleBadge`) but grants **no** battle power.
- `src/lib/components/leagues/CreateBoutModal.svelte` — `load()` filters
  `ownedLeagues = mine.filter((m) => m.role === 'owner')` (line ~147);
  the doc comments assert "only the leagues the caller owns can send a
  challenge (the satellite assert hard-rejects non-owners)".
- `src/satellite/services/battle.services.ts` — `assertSetBattle`'s
  `isOwnerOfLeague(leagueId)` helper resolves auth as
  `decodeDocData<LeagueDoc>(...).owner === callerText` (lines ~199–218).
  `isSideOwner` → `isOwnerOfLeague` for `kind='league'`. This gate is
  hit on **creation** (sideA owner check, ~299), **accept**
  (`proposed → in_flight`, sideB owner, ~414), **decline**
  (`proposed → declined`, sideB owner, ~452), and **expire** (sideA/sideB
  owner, ~468). **This is the load-bearing finding: the satellite — not
  just the FE — enforces owner-only, so admin-gating is a backend change,
  not FE-only.**
- `src/lib/services/leagues.services.ts` — `proposeBattle` (~789),
  `acceptBattle` (~899), `declineBattle` (~949), `maybeExpireBattle`
  (~981) are thin write helpers; the assert owns auth, so they need no
  role logic, only the upstream FE guards must widen.

Reuse (per `docs/ai/frontend/reusability.md` and existing code):

- The role-aware UI already exists — `LeagueRoleBadge.svelte`, the
  `battle_admin_chip`, and `canSeeInvite = owner || admin` (the
  precedent that an admin already shares an owner affordance). The new
  gate is the same boolean shape: `myRole === 'owner' || myRole ===
'admin'`.
- The member assert (`src/satellite/services/league-member.services.ts`)
  already lets the **owner** promote a member to `admin` (role change
  requires the league owner, lines ~133–135) and validates the `admin`
  role — so the `admin` role is a real, reachable state in the data model
  even though no FE promotion UI ships yet (see Open questions).
- Battle analytics taxonomy (`src/lib/types/analytics-event.ts` ~135–140)
  already has `battle_proposed` / `battle_accepted` / `battle_declined`
  and a `leagueId` prop.

## Scope

Widen the "can act as this league in a battle" authority from
**owner-only** to **owner-or-admin**, on both the frontend gates and the
satellite assert, keeping the trustless resolution model untouched.

**Satellite (`assertSetBattle`).** Introduce a single membership-role
helper — `isOwnerOrAdminOfLeague(leagueId)` — that returns true when the
caller is the league owner (current `LeagueDoc.owner` check) **or** holds
an `admin` role row in `league_members` (`getDocStore` on
`leagueMemberKey({ leagueId, memberPrincipal: callerText })`, decode,
`role === 'admin'`). Replace the owner check in the battle **command**
transitions with it:

- creation — sideA proposer must be owner-or-admin of sideA;
- `proposed → in_flight` (league accept) — sideB caller must be
  owner-or-admin of sideB;
- `proposed → declined` — sideB caller must be owner-or-admin of sideB;
- `proposed → expired` — caller must be owner-or-admin of sideA or sideB;
- same-state proposed edits — keep proposer-binds-caller (unchanged: the
  proposer is by definition whoever created it, already an admin/owner).

**Out of band, intentionally unchanged:** `in_flight → resolved` already
allows **any member of either side** (it is trustless — the assert
re-derives scores), so it is strictly more permissive than admin and
needs no change. `accepted → in_flight` (duel/legacy kickoff) and the
duel paths use `isSideOwner` where `kind='duel'` resolves to a bare
principal compare — those are duels, not leagues, and stay as-is. The
**delete/retract** path (`assertDeleteBattle`) stays **proposer-only** —
an admin who didn't create a proposal does not get to retract a peer
admin's; the proposer binds (matches the existing comment "neither
opponent nor admin gets a delete path").

**Frontend.**

- `LeagueDetailPage.svelte` — add a single derived
  `isLeagueAdmin = myRole === 'owner' || myRole === 'admin'` and route
  `canChallenge`, `canRespondToBattle`, `canKickoffBattle`, and the
  `?challenge=1`/`?propose=1` deep-link effect through it. The lazy
  **expire** sweep (currently `myRole !== 'owner'` early-return, ~852)
  widens to owner-or-admin to match the assert. The `battle_admin_chip`
  ("Admin · you") shows whenever `isLeagueAdmin`.
- `CreateBoutModal.svelte` — `load()` filters the challenger leagues to
  `m.role === 'owner' || m.role === 'admin'`; update the doc comments
  (which currently say "only the leagues the caller owns") and the
  no-leagues empty-state copy ("you must own a league to challenge" →
  "you must own or admin a league").
- **Gating copy.** Replace the silent absence of the challenge CTA for
  non-admins with an explicit line. Reuse the app i18n namespace
  (`leagues.*`); do **not** import the prototype's wording verbatim — the
  app supports multiple admins + an owner, so the copy is "owner or
  admin", not "the league admin". New key
  `leagues.detail.battle_admin_only` = "Only a league owner or admin can
  start a battle." rendered in the battle section when `!isLeagueAdmin`.
  The existing `leagues.detail.battle_owner_accepts` ("Only the league
  owner can accept this challenge.") is reworded to "Only a league owner
  or admin can accept this challenge." (key kept, value updated).

### Out of scope

- **A FE path to promote a member to `admin`.** The assert already
  permits owner-driven promotion, and this spec makes the `admin` role
  _meaningful_ for battles, but it does **not** add the promote/demote UI
  (see Open questions — without it, admin-gating only benefits leagues
  whose admins were seeded another way). If the product owner wants the
  promotion UI in the same release, it is a **separate** spec/PR (the
  member-role write surface is its own reviewable unit) — flagged, not
  silently folded in.
- **Transfer / privacy / rename / image** affordances — stay owner-only
  (`canTransfer`, `canEditPrivacy`, `canRename`, `canEditImage`
  unchanged). This spec is battle-authority only.
- **Duels** (`kind='duel'`) — bare-principal auth, untouched.
- **Retract by a non-proposer admin** — deliberately not allowed (see
  Scope).
- **Resolution authority** — already any-member, unchanged.

## Linked issues

Searched open issues on `AntonioVentilii/vici-app` for
"league admin battle challenge" and "admin role" — **no related issue**
found. (Search terms: `league admin battle challenge`, `admin role`.)

## Analytics

No **new** event names. The change widens _who_ can fire existing
events, not _what_ fires. To make the owner-vs-admin split visible in
product analysis, **add an actor-role dimension to the battle action
events** by reusing the existing bounded `label` prop (no schema change
— `label` already exists in both `AnalyticsEventProps` and the Zod
mirror):

- `battle_proposed` — already carries `label: scope` in
  `CreateBoutModal` (`label: scope`). It cannot also carry the actor
  role without overloading one bounded field; **leave `battle_proposed`
  as-is** (scope is the more valuable cut) and instead rely on the
  existing `leagueId` to join against membership offline if role-of-
  proposer is ever needed. No change.
- `battle_accepted` / `battle_declined` — these do **not** currently set
  `label`. Optionally set `label` to the actor's role
  (`'owner' | 'admin'`) where the handler already knows `myRole`
  (`LeagueDetailPage` handlers). Bounded two-value vocabulary, behavioural,
  no PII. **Pending decision** below — default: include, since the whole
  point of the spec is the owner/admin split and it is otherwise
  invisible.

No new event name lands, so no edit to `src/lib/types/analytics-event.ts`
or `src/lib/schema/analytics-event.schema.ts` is required unless the
pending decision adds the role `label` (which reuses an existing prop and
still needs no schema edit). Capture stays via `track` in
`src/lib/services/analytics.services.ts`.

## Technical requirements (satellite / backend — mandatory)

This change touches `src/satellite/services/battle.services.ts` and reads
the `league_members` collection during the battle assert.

- **Performance.** The creation, accept, decline, and expire branches
  currently call `isOwnerOfLeague`, which is **one** `getDocStore`
  (`LEAGUES`). The new helper adds **at most one** extra `getDocStore`
  (`LEAGUE_MEMBERS`, by exact key — a point read, not a scan), and only
  when the owner check fails (short-circuit owner-first to keep the
  common owner path at one read). Net: ≤ 1 extra point read per battle
  **command** write, none on the hot resolve path. Battle writes are
  low-frequency (per-proposal, per-accept), so the instruction-budget
  impact is negligible and well within IC caps.
- **Memory & storage.** No new collection, no new doc shape, no new
  field. `league_members` docs already exist (`role` already stored).
  Zero growth-rate change.
- **Scalability.** The added read is an **exact-key point lookup**
  (`leagueMemberKey`), not a prefix scan — O(1) regardless of league
  size, so it is unchanged at 10× / 100× members or battles. No new N+1.
- **Upgrade & compatibility.** **No Candid / wire-format change.**
  `BattleDoc`, `BattleState`, the `battles` API surface are all
  untouched — only the assert's internal authorisation predicate widens.
  No `satellite_extension.did` / `src/declarations/**` regeneration is
  needed for the auth change itself. (`npm run juno:functions:build` is
  still run as a build sanity check; if it regenerates nothing, nothing
  is committed.) **Non-breaking** by `pr-and-ci.md` §1 — strictly
  widens who is authorised; every previously-valid call stays valid. No
  `!` title, no `BREAKING CHANGE:` block.
- **Security.** `BATTLES` collection rules unchanged (`read: public`,
  `write: public`; the assert owns auth). The widening is deliberate and
  bounded: an `admin` is a role the **league owner alone** can grant (the
  `league_members` assert gates role changes on the owner), so admit-to-
  admin is itself owner-controlled — no privilege-escalation path is
  opened. A plain `member` still cannot propose/accept/decline/expire. A
  non-member still cannot (no `admin` row). The trustless resolve path is
  untouched, so widening command authority cannot fabricate results.
- **Parameters.** None added; the role set is the existing
  `LEAGUE_MEMBER_ROLES` / `LeagueMemberRole` in
  `src/lib/types/league-member.ts` — reuse, don't restate.

## Implementation outline

1. **Satellite assert** (`src/satellite/services/battle.services.ts`):
   add `isOwnerOrAdminOfLeague(leagueId)` next to `isOwnerOfLeague` —
   owner check first (existing `LeagueDoc.owner === callerText`), then on
   miss a `getDocStore(LEAGUE_MEMBERS, leagueMemberKey(...))` decode with
   `role === 'admin'`. Route the league branch of `isSideOwner` (and the
   creation sideA check) through it for the **command** transitions
   listed in Scope. Leave `in_flight → resolved`, `accepted → in_flight`
   (duel), the duel principal compares, and `assertDeleteBattle`
   untouched. Update the doc-comment in the file header (item 3's
   per-state list) to say "owner or admin" for the affected transitions.
2. **FE league detail** (`LeagueDetailPage.svelte`): introduce
   `const isLeagueAdmin = $derived(myRole === 'owner' || myRole ===
'admin')`; replace `canChallenge`, the `canRespondToBattle` /
   `canKickoffBattle` owner checks, the `?challenge=1` effect guard, the
   `CreateBoutModal` render guard (~1597), and the lazy-expire
   early-return (~852) with it. The `battle_admin_chip` shows on
   `isLeagueAdmin`. Add the `battle_admin_only` line in the battle
   section when `!isLeagueAdmin`.
3. **FE create-battle modal** (`CreateBoutModal.svelte`): filter
   `ownedLeagues` to `owner || admin`; update the doc comments and the
   no-leagues empty-state copy.
4. **i18n** (`src/lib/constants/messages/*.ts`): add
   `leagues.detail.battle_admin_only`; reword
   `leagues.detail.battle_owner_accepts`; reword the
   `battles.create.empty_*` "must own" copy. en is the source; the other
   catalogs follow the project's i18n flow (per
   `docs/ai/frontend/i18n.md`); pt-BR mirrors EN per the porting
   convention.
5. **Analytics (pending-decision-gated)**: if the role `label` is
   approved, set `label: myRole` in the `acceptBattle` / `declineBattle`
   `track` calls in `LeagueDetailPage`. No taxonomy edit.
6. **PRODUCT.md**: update the Battles section
   (`docs/ai/PRODUCT.md` ~246–286) — "the owner of one league proposes;
   the challenged league's owner accepts or declines" becomes "a league
   **owner or admin** proposes / accepts / declines"; keep the rest
   (privacy, trustless resolution) unchanged. Same PR as the behaviour
   change.
7. **Gates**: `npm run quality`, `npm run check`, and
   `npm run juno:functions:build` (commit only if it regenerates).

## Acceptance criteria

- [ ] A league **admin** (a `league_members` row with `role === 'admin'`)
      can open the challenge sheet, propose a battle, and the satellite
      accepts the write.
- [ ] A league admin can **accept** and **decline** an incoming
      challenge to their league; the satellite accepts both.
- [ ] The owner retains every battle power exactly as before (no
      regression).
- [ ] A plain **member** sees "Only a league owner or admin can start a
      battle." in the battle section and has no challenge / accept /
      decline / kickoff affordance; a direct satellite write by a member
      is rejected.
- [ ] A **non-member** principal's battle command write is rejected by
      the assert (no `admin` row, not the owner).
- [ ] `CreateBoutModal` lists leagues where the caller is owner **or**
      admin as the challenger side; member-only leagues are excluded.
- [ ] The lazy-expire sweep fires for an admin (not only the owner).
- [ ] Retract stays proposer-only — an admin who didn't propose cannot
      retract a peer's proposal.
- [ ] No Candid / declarations diff from the auth change;
      `npm run quality` + `npm run check` pass.
- [ ] `PRODUCT.md` Battles section reads "owner or admin".

## Open questions

- **Is there any shipped path to promote a member to `admin` today?** The
  satellite assert permits owner-driven promotion and the role renders in
  the UI, but no FE promote/demote control was found
  (`role: 'admin'` is set nowhere in `src/lib/components` or the league
  services). If none ships, admin-gating is **latent** — correct and
  testable, but only exercisable once an `admin` row exists (seeded
  manually or by a future spec). Confirm with the product owner whether
  the promotion UI must ship alongside this (→ separate spec, see Out of
  scope) or whether latent admin-gating is acceptable for this release.
- **Duel battles** — confirmed they use bare-principal auth and no FE
  path creates them; no admin concept applies. (Verified in
  `assertSetBattle`; listed for completeness.)

## Pending decisions

- **Actor-role analytics `label` on `battle_accepted` / `battle_declined`.**
  Facts are clear (the `label` prop exists and is bounded; the handler
  knows `myRole`); the call is whether the owner-vs-admin cut is worth
  setting it. Default: **include** — it is the only way the split is
  visible in product analysis, and it reuses an existing bounded field
  with no schema change. Owner: product/analytics.
- **Ship the admin-promotion UI in this release or defer it.** If
  deferred, this spec ships latent admin-gating (see Open questions). If
  bundled, it is a **separate** spec/PR per the one-spec-one-PR rule, not
  folded here. Owner: product.

## Decisions

Handed to the author for this port (with the why):

- **Keep the app i18n namespace** (`leagues.*`), not the prototype's
  scattered `lg.*` / `bt.*` keys — the app's catalog convention wins
  (per the shared port brief and `docs/ai/frontend/i18n.md`).
- **No emoji** — the app uses lucide icons; the prototype's stray emoji
  do not transfer.
- **Port behaviour, not code** — the prototype is React on a single-
  `adminId` model; the app is Svelte 5 runes on a three-value
  `LeagueMemberRole`. "Admin" here means the app's delegated `admin`
  role **in addition to** the owner, not a rename of the owner.
- **Gate on both FE and satellite** — chosen because the satellite assert
  independently enforces owner-only (`isOwnerOfLeague`), so an FE-only
  change would leave admin writes rejected by the backend. The auth
  predicate widens server-side; no Candid surface changes.
- **Retract stays proposer-only** — widening command authority to admins
  does not extend to deleting a peer admin's proposal; the proposer
  binds, matching the existing `assertDeleteBattle` contract.
