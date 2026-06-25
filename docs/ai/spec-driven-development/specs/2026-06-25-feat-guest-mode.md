# Spec: Guest mode — "Model B" predict-then-convert funnel

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

A signed-out visitor who takes the "Skip — preview first, sign-up
later" path out of onboarding can predict immediately — no account, no
balance, no wall — and keep predicting freely. Their picks are held
locally as zero-stake "shadow" positions. Loss-aversion, not a gate,
drives conversion: a celebratory "save your pick" sheet after the first
pick, a gentle reminder every fifth pick, and a standing inline "Sign up
to save your pick" CTA on Flow whenever the guest has at least one pick.
On sign-up the guest becomes a member, the existing 1,500 VXP starter
grant lands, and their held picks are **retro-staked** at their locked
entry price (clamped to the grant) so the picks they made as a guest
become real positions — they finish in Flow as a member with no work
lost.

## Context

This is the highest-blast-radius spec of the V1.8 port: it touches the
identity/auth gate (signed-out users currently cannot predict at all),
the prediction submit path (real orders go FE→engine and require an
authenticated identity), the VXP/holdings derived stores (a guest has no
ledger balance), and introduces **retro-stake math** that converts
zero-stake shadow picks into real engine positions on conversion. It
**layers on top of** Onboarding V3
(`specs/2026-06-25-feat-onboarding-v3.md`) — the "Skip — preview first,
sign-up later" button is wired there and hands off here. The sign-in
re-skin is a separate spec.

### App side (Svelte 5, the port target)

Current state — **there is no guest mode today**:

- `src/routes/(app)/+layout.svelte` (~209–211) redirects to `/signin`
  when `$userSignedOutResolved && !$userSignedIn`. Every `(app)/*` route
  is gated except the public exemptions (`/markets`, `/markets/*`,
  `/info/*`). A signed-out user cannot reach Flow or a prediction
  surface at all.
- `src/lib/components/market/TradeModal.svelte` (~177–235) renders
  `SignInActions` instead of the stake slider / submit when
  `!$userSignedIn` — so even if the surface were reached, the predict
  control is replaced by a sign-in prompt.
- `src/lib/services/order.services.ts` `placeOrder` (~108) threads the
  identity via `safeGetIdentityOnce`
  (`src/lib/services/identity.services.ts`, ~132) and **throws** if the
  caller is not authenticated. Real orders go FE→engine
  (`docs/engine-integration.md`); the engine is agnostic and requires a
  real principal. **A guest therefore cannot place a real order** — this
  is the architectural reason guest picks must live client-side until
  conversion.

Identity / auth state:

- `src/lib/stores/user.store.ts` — `userStore` (`{ user, profile,
authBusy, profileExisted }`); `user` is the Juno session (undefined
  signed-out).
- `src/lib/derived/user.derived.ts` — `userSignedIn` (~10),
  `userNotSignedIn` (~12), `userSignedOutResolved` (~20, `!authBusy &&
!user`), `authPrincipal` (~25).

The prediction entry path (the prototype's `onPredict`):

- `src/lib/components/market/FlowMode.svelte` — the swipe deck; commits a
  prediction via `flowTradeService.executeTrade`
  (`src/lib/services/flow.services.ts`, ~23) →
  `executeOutcomeTrade` (`src/lib/utils/trade.utils.ts`, ~51) →
  `placeOrder`. This is the chain a guest pick must branch out of
  **before** the identity check.

VXP / holdings derived stores (a guest has none):

- `src/lib/derived/vxp-holdings.derived.ts` — `vxpSpendable` (~196),
  `vxpBacked` (~199), `vxpHoldingsTotal` (~203),
  `vxpHoldingsNotInitialized` (~189). These read the ledger for the
  signed-in principal; for a guest they are simply empty / not
  initialized, which is why guest picks must be stake-0 and the
  conversion grant is what first populates a real balance.

The starter grant (already exists — convert reuses it, does not add it):

- The "1,500 VXP starter pack" is the existing onboarding grant. When a
  guest converts and a **new profile is created**, the satellite hook
  `onProfileSetForVxpOnboarding`
  (`src/satellite/services/vxp-onboarding.services.ts`, registered in
  `src/satellite/index.ts`) fires the grant exactly as it does for any
  new member — amount from `newUserVxpAmountMilestone1BaseUnits()` /
  `NEW_USER_VXP_TOTAL_BASE_UNITS`
  (`src/lib/constants/vxp-onboarding.constants.ts`). **Conversion does
  not introduce a new mint** — it routes a guest through the normal
  new-member creation, so the existing grant lands. The genuinely new
  economic action is the **retro-stake** (below).

Pre-auth pick persistence (the mechanism to reuse, not reinvent):

- Governed by
  `specs/2026-06-18-fix-onboarding-picks-persist-across-providers.md`
  (In progress #926). Storage key `PENDING_ONBOARDING_STORAGE_KEY`
  (`'vici:pending-onboarding'`,
  `src/lib/constants/profile.constants.ts` ~54). Writer
  `handleCompletePreAuth` (`src/routes/signup/+page.svelte` ~99),
  merge-safe (preserves referral / league / email). Drain effect in
  `src/routes/(app)/+layout.svelte` (~222) runs `drainPendingOnboarding`
  (`src/lib/services/onboarding-handoff.services.ts` ~406) on the
  new-user branch, applying picks via `applyOnboardingPicks`
  (`src/lib/services/profile.services.ts` ~442). Guest picks follow this
  stash → drain-on-first-authenticated-layout shape; they do **not**
  invent a new persistence path. (See Pending decisions for the exact
  storage-key / store split.)

Overlay-collision gating (so the save sheet never stacks on a reveal):

- `src/lib/stores/menagerie-celebration.store.ts` —
  `menagerieCelebrationStore` (`{ current, queue }`).
- `src/lib/stores/flow-beat.store.ts` — `flowBeatActiveStore`
  (writable<boolean>), `setFlowBeatActive`.
- `src/lib/components/menagerie/MenagerieCelebrationHost.svelte` (~118)
  gates the reveal on `reveal && !beatActive` — the **exact pattern**
  the guest save-sheet must adopt (prototype V1.8.35: render only when
  `!menagerieReveal && !beatActive`).

Reusable UI / services (per `docs/ai/frontend/reusability.md`):

- `src/lib/components/ui/BottomSheet.svelte` — `BottomSheet` (`isOpen`,
  `onClose`, `footer`, `desktopCentered`, `labelledBy`). The save sheet
  builds on this, the app analogue of the prototype's `Sheet`. The
  prototype's `GuestSaveSheet` (`guest-save-sheet.jsx`) is the reference
  for copy and structure only.
- `src/lib/components/authn/SignInProviderStack.svelte` —
  `SignInProviderStack` (`mode="signup"`, `handle`, `onSuccess`). The
  save sheet's sign-up CTAs **reuse this stack** rather than the
  prototype's two-button Google/email subset. Conversion runs through the
  same provider machinery (redirect-safe stashing included).
- `src/lib/stores/notification.store.ts` — `notificationsStore.add(...)`
  for the "1,500 VXP added" toast.

### Prototype side (React, source of truth — port behaviour/UI/copy, not code)

`/tmp/.../proto/VICI-V1.8-Handover/`:

- `guest-save-sheet.jsx` — `GuestSaveSheet`: two roles, one component.
  `kind:'soft'` (celebratory first-pick ask) and `kind:'remind'` (the
  every-5th nudge). Pluralised body via `gs.picks_one` / `gs.picks_many`.
  Sign-up calls `window.__viciConvertGuest({ authMethod, email })`.
- `app.jsx` — the guest logic: `onPredict` (~597) forces `stake=0,
bonus=0` for every guest pick and drives the cadence off a
  session-scoped `guestPicksRef` (~362, 1st-celebrate / every-5th-remind,
  **not** lifetime `me.calls`); the soft/remind sheet setters (~722–727);
  the render gate `guestSave && !menagerieReveal && !beatActive` (~832);
  the standing inline CTA `me.guest && me.calls >= 1 && route==='flow'`
  (~819); `convertGuest` (~286).
- CHANGELOG: V1.8.7 (guest infra + save-sheet birth), V1.8.35 (sequence
  the sheet **after** the Hatchling reveal — the collision gate),
  V1.8.36–37 (gate-once / save-framing copy — superseded by .38), V1.8.38
  (Model B: remove the hard block, keep predicting freely), V1.8.39
  (audit fixes — **retro-stake on convert**, pluralised copy, `'hard'` →
  `'remind'`, session-scoped cadence). The CTO header domain-1 scopes the
  guest funnel to this spec.

> **Prototype divergence to record (Open question 1).** The handover
> `app.jsx` `convertGuest` (~286) is the **demo-drop** variant — it
> filters out guest picks (`recentCalls.filter(c => !c.demo)`) and resets
> to a clean Day 0, treating guest play as throwaway practice. The
> CHANGELOG's later entries (V1.8.38–39) and the CTO header describe the
> **retro-stake** variant — guest picks become real positions at convert.
> These contradict. This spec ports the **retro-stake** intent (the
> brief's source of truth and the more recent CHANGELOG state); the
> code-vs-changelog conflict is flagged below.

### Reusability

Guest mode is a re-composition over existing infrastructure, not new
infra: the pre-auth stash/drain pipeline, `BottomSheet`,
`SignInProviderStack`, `notificationsStore`, the celebration/beat gate
stores, and the existing onboarding grant. The genuinely new code is (a)
a small guest-session store, (b) the guest-pick branch in the Flow
commit, (c) the save-sheet component + cadence, and (d) the retro-stake
reconciliation on convert.

## Scope

Guest predicting + the convert funnel only. The Skip entry point is
Onboarding V3's; the sign-in re-skin is a separate spec.

### 1. Guest session state

A small client-only guest store (e.g.
`src/lib/stores/guest.store.ts`) holding `{ isGuest, handle,
sessionPickCount }`, hydrated from / persisted to localStorage alongside
the picks stash. `isGuest` is set when the V3 Skip path completes (an
auto-assigned or claimed handle, no auth). `sessionPickCount` is
**session-scoped** and drives the cadence (mirrors the prototype's
`guestPicksRef`, deliberately **not** a lifetime count) so a returning
guest cannot misfire the first-pick celebration. Cleared on conversion
and on a real sign-out.

A `guestMode` derived (`src/lib/derived/`) exposes `isGuest` for surfaces
to gate on — analogous to the prototype's `__viciIsGuest`.

### 2. Let a guest reach Flow and predict

- **Route gate** (`(app)/+layout.svelte`): allow a guest session to
  reach Flow (and the surfaces guest mode needs) without redirecting to
  `/signin`. The gate currently keys off `userSignedOutResolved`; it must
  treat an active guest session as "may proceed" for the guest-allowed
  routes (at minimum Flow), while still redirecting a plain signed-out
  visitor. Exact allowed-route set under Pending decisions.
- **Predict control** (`TradeModal.svelte` / `FlowMode.svelte` commit):
  for a guest, render the predict control (not `SignInActions`) and route
  the commit through a **guest-pick branch** that does **not** call
  `placeOrder` / `safeGetIdentityOnce`. The guest pick is recorded as a
  zero-stake shadow position in the picks stash; no engine call, no
  balance check. (Stake-0 picks also cannot move engine prices — there is
  an existing `stake>0` guard prototype-side — so free guest play cannot
  pollute markets. Confirm the app's order path has the equivalent
  property: a guest pick never reaches the engine at all here, which is
  strictly safer.)
- Every guest pick is free; there is **no hard block** at the 2nd pick or
  ever (Model B, V1.8.38). The funnel is nudges + a standing CTA.

### 3. Guest picks persistence (reuse the pre-auth stash pipeline)

- A guest pick is appended to a pre-auth stash following the
  `PENDING_ONBOARDING_STORAGE_KEY` pattern. Each entry captures what
  retro-stake needs: `{ marketId, outcome/side, entryPrice, ts }` —
  `entryPrice` is the locked fill price at pick time (the prototype's
  `entry`), the source of truth for retro-stake.
- Whether guest picks share the onboarding stash (extend
  `PendingOnboarding` with a `guestPicks[]` field) or live under a
  sibling key (e.g. `'vici:pending-guest-picks'`) is a Pending decision —
  but the **drain trigger and the new-user reconciliation point are the
  same** `(app)/+layout.svelte` effect that already drains onboarding, so
  there is one place where a freshly-created member reconciles everything
  stashed pre-auth.

### 4. The save sheet + cadence

New `src/lib/components/guest/GuestSaveSheet.svelte` built on
`BottomSheet`, mounted once at the app shell beside the other overlays.

- **Soft** (after pick 1): celebratory, fully dismissible — "Nice call —
  save your pick & claim 1,500 VXP." Dismiss = keep previewing.
- **Remind** (every 5th pick thereafter): the gentle "Sign up to save
  your N picks and 1,500 VXP" nudge; body **pluralises** on the
  session pick count (`gs.picks_one` / `gs.picks_many`). Soft (pick 1) is
  always singular.
- **Standing inline CTA**: a calm pill on Flow whenever the guest has ≥1
  pick (`isGuest && sessionPickCount >= 1 && route === Flow`), opening the
  sheet on tap. Never blocks a card.
- **All dismissible; none blocks.** The 1,500 VXP figure comes from
  `newUserVxpAmountMilestone1BaseUnits()` via `formatVxpBalance`, not a
  hardcoded literal.
- **Collision gate (V1.8.35):** the sheet renders only when no reveal /
  beat is active — read `menagerieCelebrationStore.current` +
  `flowBeatActiveStore` and gate on `!reveal && !beatActive`, the same
  pattern `MenagerieCelebrationHost` uses. The earned celebration
  (Hatchling/menagerie reveal) plays uninterrupted; the ask renders the
  moment the reveal clears. No timing hacks.
- **Sign-up CTAs** mount `SignInProviderStack mode="signup"
handle={guestHandle}` so conversion runs through the real provider
  stack (redirect-safe). The prototype's bespoke Google/email buttons are
  reference copy only.

### 5. Conversion + retro-stake (the new economic action)

On a successful sign-up from the guest funnel:

- The new member profile is created → the **existing**
  `onProfileSetForVxpOnboarding` grant fires (1,500 VXP). No new mint
  surface, no convert-specific grant code.
- The drain (new-user branch, `(app)/+layout.svelte` →
  `onboarding-handoff.services.ts`) reconciles the stashed guest picks:
  for each open zero-stake shadow pick, **retro-stake** at its locked
  `entryPrice`, recomputing `shares` / `toWin` / `costBasis` so the pick
  becomes a real position. The default per-pick stake and the **clamp so
  the total retro-stake never exceeds the granted pack** (leftover stays
  spendable) are economy parameters — sourced from a constants file, not
  hardcoded (the prototype used "default 100 each, clamped to the grant";
  the app must pick a constant-backed value — see Pending decisions and
  the Technical-requirements section).
- After conversion: `notificationsStore.add(...)` toasts "1,500 VXP
  added"; the guest store is cleared; the user lands in Flow as a member
  with their picks now real.

> **How retro-stake creates real positions.** A real position requires a
> cleared engine order. Whether retro-stake (a) replays each pick as a
> real `placeOrder` against the engine at convert time (at current book,
> not the stale entry — a divergence), or (b) the pick is reconstructed
> as a position record only, is an **open question with backend
> implications** (Open question 2 + Technical requirements). The
> prototype recomputes the numbers client-side because its engine is
> simulated; the app's engine is real and authoritative.

### Out of scope

- **The V3 onboarding screen and the Skip button itself** — owned by
  `specs/2026-06-25-feat-onboarding-v3.md`. This spec consumes the Skip
  hand-off, it does not build the screen.
- **The sign-in re-skin** (`/signin`, V1.8.24–28) — separate spec.
- **A2HS install nudge** (V1.8.34) — separate spec; the prototype notes
  the A2HS auto-prompt is **members-only because guests convert first**,
  so the two funnels are deliberately sequenced but built separately.
- **Anti-farm gating of the onboarding grant (#543).** Conversion routes
  a guest through new-member creation, so it inherits the existing
  onboarding-grant threat model and any future #543 hardening — it does
  not change it here. But guest mode **widens the new-account mint
  surface** (a brand-new account can now be created with picks already in
  hand); this is flagged in Technical requirements and as a pending
  decision, not solved here.
- **Changing any economy amount or the grant size** — those are the
  signed-off constants.
- **Server-authoritative guest-pick storage.** Guest picks are
  client-only until conversion (no satellite doc for a session with no
  principal); a cleared browser loses unsaved guest picks, which is the
  intended loss-aversion pressure, not a bug.

## Linked issues

Searched the repo's open issues (`guest`, `convert`, `sign up`,
`onboarding`) on 2026-06-25 via the GitHub API. Only **#543**
(anti-farm: gate referral/onboarding payouts on an authoritative trade,
not the client activity log) is adjacent — it bounds the new-account
mint that conversion exercises. It is explicitly **out of scope** here
(no closing keyword); reference it as **Part of the same threat surface**
under Technical requirements. No issue tracks guest mode itself — new
feature, no closing keyword.

## Analytics

Instrument the funnel; reuse existing event names and the bounded props
bag (`src/lib/types/analytics-event.ts` + the Zod mirror
`src/lib/schema/analytics-event.schema.ts`). The `source` /
`label` / `ok` / `count` dimensions cover the funnel without a new prop
key, so **no dual-source union/Zod edit and no satellite analytics-wire
regen** is required — preferred over minting new names.

- **Guest first pick / subsequent picks** → reuse `position_taken`
  (`src/lib/types/analytics-event.ts` ~76) with `source: 'guest_flow'`
  and `count` = the session pick number. Distinguishes guest activity
  from member activity by `source` without a new event.
- **Save sheet shown** → reuse a generic surface event; if none fits
  cleanly, the minimal addition is **one** new event
  `guest_save_prompted` carrying `label: 'soft' | 'remind' | 'inline'`
  and `count` (session pick number). Adding it means landing the name in
  **both** the TS union and the Zod mirror, with capture via `track()` —
  call this out so the implementer does both halves.
- **Conversion** → `signed_up` (~27) with `source: 'guest_convert'` and
  `label` = the finishing provider, so the guest→member funnel is
  separable from a cold signup. `onboarding_completed` still fires once
  via the drain (per the persist spec), so conversion is not double-
  counted as a fresh onboarding.

Behavioural only — bounded vocab, no PII / free-text. Whether
`guest_save_prompted` is worth a new name vs. folding into an existing
event is a Pending decision (it gates whether the union/Zod edit
happens).

## Technical requirements (satellite / backend)

Guest predicting is **pure-frontend** (no satellite write for a session
with no principal). The satellite/backend surface is touched only at
**conversion**, and only through existing paths — but the numbers must be
stated because retro-stake exercises the economy:

- **Performance / call frequency.** Conversion creates one new profile
  (existing path) and reconciles N stashed picks once. N is bounded by a
  single guest session's picks — small (single digits to low tens). If
  retro-stake replays picks as real engine orders (Open question 2), that
  is N order placements at convert time, sequential, one-off per
  conversion — not a per-swipe cost. No new hook fires per guest pick
  (there is no guest write).
- **Memory & storage.** No new collection for guest sessions (client
  localStorage only). At conversion the only new docs are whatever the
  retro-staked positions/orders already produce through the normal trade
  path. The onboarding grant writes its existing `vxp_awards` doc — no
  new award type.
- **Scalability.** Guest sessions cost the satellite nothing (no writes).
  Conversions scale as new-member signups already do. The retro-stake
  loop is per-user, bounded by one session's picks — no N+1 fan-out
  across users.
- **Upgrade & compatibility.** If retro-stake is purely FE
  reconciliation through existing `placeOrder` / engine APIs, **no `.did`
  / bindings regeneration and no breaking change**. If it needs a new
  satellite endpoint to atomically grant-then-retro-stake (Open question
  2 / Pending decision), that is a candid-surface change requiring
  `npm run juno:functions:build` + committed regenerated bindings, and
  must be re-scoped — flagged, not assumed.
- **Security / anti-farm.** Conversion is a **new-account mint** (the
  1,500 VXP grant). Guest mode lowers the cost of reaching that mint (no
  upfront friction), so it sits squarely on the **#543** surface. The
  existing defense is Internet-Identity-gated sign-up (a real per-account
  cost); retro-stake must not let a guest mint **more** than the grant —
  the **clamp (total retro-stake ≤ grant)** is the structural bound and
  must be enforced server-side if retro-stake mints/positions are
  authoritative, not only in the FE preview (per `docs/ai/economy.md`
  principle 3: client previews, server is authoritative). Propose, per the
  economy doc's anti-farm posture, that retro-stake gate on the clamp and
  not exceed the grant under any client manipulation.
- **Parameters.** The per-pick default retro-stake and the grant-clamp
  ceiling are economy values — they belong in
  `src/lib/constants/vxp-economy.constants.ts` (or
  `vxp-onboarding.constants.ts`), cited not restated, per
  `docs/ai/economy.md` (it never restates a number). The grant amount is
  already `newUserVxpAmountMilestone1BaseUnits()` /
  `NEW_USER_VXP_TOTAL_BASE_UNITS`.

> This section stays **mandatory and unresolved** until Open question 2
> and the retro-stake authority decision land: a `Draft` that proposes a
> server-authoritative retro-stake is not buildable until the backend
> shape is confirmed (and may need an icdc-core-side change — separate
> repo, separate PR, per `docs/ai/backend/README.md`).

## Implementation outline

1. **Guest store** — `src/lib/stores/guest.store.ts` (`{ isGuest,
handle, sessionPickCount }`, localStorage-backed) + a `guestMode`
   derived under `src/lib/derived/`. Set on V3 Skip completion; cleared
   on convert / sign-out.
2. **Route gate** — `(app)/+layout.svelte`: let an active guest session
   reach the guest-allowed routes (Flow at minimum) instead of bouncing
   to `/signin`. Keep the plain signed-out redirect intact.
3. **Predict control** — `TradeModal.svelte` / `FlowMode.svelte`: for a
   guest, render the predict control and branch the commit into a
   guest-pick path that records a zero-stake shadow pick to the stash —
   never calls `placeOrder` / `safeGetIdentityOnce`. Increment
   `sessionPickCount`.
4. **Picks stash** — extend the pre-auth stash (shared key vs sibling
   key per Pending decision) with `guestPicks[] = { marketId,
side/outcome, entryPrice, ts }`, written through a merge-safe writer
   in the `handleCompletePreAuth` family so referral/league/email survive.
5. **Save sheet** — `src/lib/components/guest/GuestSaveSheet.svelte` on
   `BottomSheet`; soft / remind / inline variants; pluralised copy; the
   `!reveal && !beatActive` collision gate; `SignInProviderStack
mode="signup"` CTAs; VXP figure from
   `newUserVxpAmountMilestone1BaseUnits()`. Mount once at the app shell.
   Cadence: soft on pick 1, remind every 5th, standing inline CTA while
   `sessionPickCount >= 1` on Flow.
6. **Convert + retro-stake** — in the drain's new-user branch
   (`onboarding-handoff.services.ts` + `(app)/+layout.svelte`), after the
   profile is created and the grant fires: reconcile each stashed guest
   pick into a real position by retro-staking at its locked `entryPrice`,
   clamped so the total ≤ grant (constant-backed). Toast "1,500 VXP
   added" via `notificationsStore`; clear the guest store. (The exact
   retro-stake mechanism — replay as real orders vs reconstruct positions
   — is Open question 2; the loop and clamp are the same either way.)
7. **i18n** — 18 `gs.*` keys ported into the app's namespace (not the
   prototype's bare `gs.*`; see Decisions) across all six locales
   (en/it/fr/de/es/pt-BR) in `src/lib/constants/messages/*.ts`. Run
   `npm run quality` to catch missing-locale gaps.
8. **Analytics** — `position_taken` (`source: 'guest_flow'`),
   `signed_up` (`source: 'guest_convert'`, `label` = provider), and (if
   approved) `guest_save_prompted` in **both** the TS union and Zod
   mirror; capture via `track()`.
9. **PRODUCT.md** — document the guest funnel (free predicting, no wall,
   loss-aversion conversion, retro-stake, the client-only picks
   limitation, and the #543 new-account-mint note) in the same PR.
10. `npm run quality` + `npm run check` (and, only if a satellite
    endpoint is added, `npm run juno:functions:build` + committed
    regenerated bindings).

## Acceptance criteria

- [ ] A visitor who takes "Skip — preview first, sign-up later" reaches
      Flow and can make a prediction with no account and no balance — the
      predict control shows, not a sign-in prompt.
- [ ] A guest can keep predicting indefinitely; no pick is ever blocked
      (no hard gate at the 2nd pick or any later pick).
- [ ] Guest picks are recorded as zero-stake shadow picks and never reach
      the engine (no `placeOrder` / identity call) — free guest play
      cannot move market prices.
- [ ] After pick 1 the **soft** save sheet shows (celebratory,
      dismissible); every 5th pick after shows the **remind** sheet with
      correctly **pluralised** copy; a standing inline "Sign up to save
      your pick" CTA shows on Flow whenever the guest has ≥1 pick. All
      dismissible; none blocks a card.
- [ ] The save sheet never stacks on a menagerie reveal or a Flow beat —
      it waits until `!reveal && !beatActive`, then renders.
- [ ] The cadence uses a **session-scoped** pick count, so a returning
      guest does not re-fire the first-pick celebration.
- [ ] On sign-up from the funnel the guest becomes a member, the existing
      1,500 VXP grant lands, and every held pick is **retro-staked** at
      its locked entry price (clamped so the total ≤ grant; leftover stays
      spendable) — the picks become real positions, nothing is lost.
- [ ] A "1,500 VXP added" toast shows on conversion; the guest session
      state is cleared.
- [ ] All 18 `gs.*` keys resolve in en/it/fr/de/es/pt-BR; no gambling
      vocabulary, no "bet", no emoji (lucide icons only).
- [ ] Analytics fire: guest pick (`position_taken`, `source:
    'guest_flow'`) and conversion (`signed_up`, `source:
    'guest_convert'`); any new event name lands in both the TS union and
      the Zod mirror.
- [ ] `npm run quality` and `npm run check` pass (plus regenerated
      bindings if a satellite endpoint is added).

## Open questions

- **1 — Which `convertGuest` is the intended design: demo-drop or
  retro-stake?** The handover `app.jsx` `convertGuest` (~286) drops guest
  picks as throwaway practice; CHANGELOG V1.8.38–39 and the CTO header
  describe retro-staking them into real positions. This spec ports
  retro-stake (the brief's stated source of truth and the more recent
  CHANGELOG state), but the code and the changelog literally disagree —
  confirm retro-stake is the intent before building, since it is the bulk
  of the new work.
- **2 — How does retro-stake create a _real_ position against the
  authoritative engine?** A real position needs a cleared engine order
  (`placeOrder` → engine). Options: (a) at convert, replay each held pick
  as a real order — but at the **current** book, not the stale guest-time
  `entryPrice`, so the locked price the guest saw may not be honourable;
  (b) honour the guest's locked `entryPrice`, which the agnostic engine
  cannot do without a special path; (c) reconstruct a position record
  without a real clearing trade, which diverges from "every position is a
  cleared engine trade." The prototype recomputes client-side because its
  engine is simulated; the app's engine is real
  (`docs/engine-integration.md`). This likely needs **backend input** and
  may touch icdc-core (separate repo / PR). Resolve before the retro-stake
  scope is buildable.
- **3 — Does the existing onboarding-grant hook fire correctly for a
  converted guest, and exactly once?** Confirm `onProfileSetForVxpOnboarding`
  treats a converted-guest profile creation identically to a cold signup
  (it should, since convert creates a normal new profile), and that the
  #926 persist-spec drain reconciliation and the grant do not race or
  double-fire.
- **4 — Where exactly does the route gate let a guest through?** Confirm
  the minimal allowed-route set (Flow only, or also market detail /
  results) against what the guest funnel actually needs, and that
  `userSignedOutResolved` consumers elsewhere don't misread a guest
  session as signed-in.

## Pending decisions

- **Guest-picks storage: extend the onboarding stash vs a sibling key.**
  Share `PENDING_ONBOARDING_STORAGE_KEY` (add a `guestPicks[]` field, one
  drain) or use a sibling `'vici:pending-guest-picks'` key (separate
  slot, drained in the same effect). Both reconcile at the same new-user
  drain point; pick the one that keeps the merge-safe writer simplest and
  doesn't bloat the onboarding payload. Owner: FE architecture.
- **Retro-stake economics: per-pick default stake + grant-clamp rule.**
  The prototype used "default 100 each, clamped so the total ≤ grant,
  leftover spendable." The app must back these with constants in
  `vxp-economy.constants.ts` and decide the clamp policy (proportional
  scale-down vs first-N-fit) and whether unstaked overflow picks are
  dropped or left as zero-stake. Owner: economy. (Gated by Open
  question 2 — if retro-stake replays real orders at the live book, "stake
  at locked entry" may not be expressible.)
- **Whether `guest_save_prompted` is a new analytics event.** Folding the
  prompt-shown signal into an existing event avoids a union/Zod edit and a
  potential analytics-wire regen; a dedicated name gives a cleaner funnel.
  Decide before instrumenting (it gates the dual-source edit). Owner:
  product analytics.
- **Guest-allowed route set.** Flow only (tightest) vs Flow + market
  detail + results (richer preview). Owner: product. (Tied to Open
  question 4.)
- **Server-side enforcement of the retro-stake clamp.** Per
  `docs/ai/economy.md` principle 3, if retro-stake mints/positions are
  authoritative the clamp must hold server-side, not only in the FE
  preview — which may require a satellite endpoint (re-scoping the spec
  to touch the candid surface). Decide once Open question 2 resolves.
  Owner: economy + backend.

## Decisions

- **Keep the app's i18n namespace.** The 18 `gs.*` keys land under the
  app's `app`/`onboarding`-style namespace convention, not the
  prototype's bare scattered `gs.*` prefix — per the project's namespace
  rule and the brief. Exact prefix mirrors how V3 mapped `obv3.*` →
  `onboarding.v3.*`.
- **No emoji.** lucide icons only; the prototype's inline SVGs / stray
  emoji do not transfer (the save sheet uses lucide equivalents and
  `CountryFlag.svelte` where flags are needed).
- **Model B, not a wall (V1.8.38).** A guest predicts freely with no hard
  block; conversion is driven by loss-aversion (save-your-pick) not a
  gate. The earlier hard-gate variants (V1.8.36–37) are superseded and
  are **not** ported.
- **Reuse the pre-auth stash/drain pipeline, not a new mechanism.** Guest
  picks follow the `PENDING_ONBOARDING_STORAGE_KEY` stash → first-
  authenticated-layout drain shape already governed by the #926 persist
  spec, reconciling at the same new-user branch — one place where a fresh
  member absorbs everything stashed pre-auth.
- **Reuse the existing onboarding grant for the 1,500 VXP, not a
  convert-specific mint.** Conversion creates a normal new member, so
  `onProfileSetForVxpOnboarding` fires the grant as-is — conversion adds
  no new mint surface (only the retro-stake action, bounded by the
  grant-clamp).
- **Reuse `BottomSheet` + `SignInProviderStack`, not the prototype's
  bespoke sheet/auth.** The save sheet is `BottomSheet` and its sign-up
  CTAs are the real provider stack (redirect-safe), so there is one
  source of truth for sheets and for auth.
- **Session-scoped cadence (V1.8.39 #4).** First-celebrate / every-5th-
  remind keys off a session pick count, not a lifetime call count, so a
  returning guest never misfires the first-pick celebration.

## Dependencies

- **Onboarding V3 (`specs/2026-06-25-feat-onboarding-v3.md`, Draft).**
  Provides the "Skip — preview first, sign-up later" entry into this
  funnel; that spec wires the button, this spec owns the funnel. If V3
  ships first, V3's interim-Skip-target pending decision covers the gap.
- **Onboarding picks persist across providers
  (`specs/2026-06-18-fix-onboarding-picks-persist-across-providers.md`,
  In progress #926).** Guest mode reuses its stash-before-auth + the
  new-user drain branch for guest-pick reconciliation; Open question 3
  and the storage-key decision bind to #926 as merged.
- **Anti-farm gating (#543, open).** Conversion exercises the new-account
  mint #543 hardens; guest mode widens that surface but does not solve it
  here — Part of #543's threat scope, tracked there.
- **Sign-in re-skin (separate spec).** The save sheet links into
  sign-up; the `/signin` re-skin is its own work.
