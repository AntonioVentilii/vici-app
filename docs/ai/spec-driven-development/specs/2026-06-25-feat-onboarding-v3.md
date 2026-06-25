# Spec: Onboarding V3 — one-step handle + sign-up

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

Replace the V2 three-beat onboarding (team → first call → handle → auth)
with a single screen: the new user claims a handle (live availability +
Roman-pool suggestions) and signs up (Google or email→passkey) in one
view, sees the "1,500 VXP starter pack" reward anchor, and can either
skip to preview as a guest or jump to sign-in if they already have an
account. Team selection and the in-onboarding first call are dropped —
the team moves to the post-signup Profile, the first prediction now
happens free in-app. V3 ships flag-gated and default-on, with V2 left
intact and reachable behind the flag until V3 is verified in production.

## Context

### App side (Svelte 5, the port target)

- Entry route: `src/routes/signup/+page.svelte` — mounts
  `OnboardingFlow`, owns the pre-auth stash (`handleCompletePreAuth`),
  the authenticated direct-write (`handleCompleteAuthenticated`), and the
  returning-user bounce to `AppPath.Flow`.
- Current flow + beats under `src/lib/components/onboarding/`:
  - `OnboardingFlow.svelte` — the `1a → 1b → 2 → 3` state machine.
  - `OnboardingBeat1.svelte` / `OnboardingBeat1Card.svelte` — team picker
    + derived first call (V3 drops both).
  - `OnboardingBeat2.svelte` — handle picker. **Reuse target.** Holds the
    live-availability probe, the pool sampling, and the claim-time TOCTOU
    re-check we port into V3.
  - `OnboardingBeat3.svelte` — auth gate; mounts
    `SignInProviderStack mode="signup"` + the starter-pack strip + ToS.
  - `OnboardingStepTracker.svelte` — `Vici · N of 3` tracker (V3 has one
    screen → not rendered).
  - `FlowCoach.svelte` — first-run in-app coach. **Already shipped, out of
    scope**; V3 hands off to it unchanged after sign-up.
- Auth surface: `src/lib/components/authn/SignInProviderStack.svelte` —
  `apple | google | email | ii | passkey | dev`, per-provider enable
  flags, the pre-`run()` provider/email stashing, the Google full-page
  redirect. **Reused as-is** by V3.
- Handle logic to reuse (cite, don't re-implement):
  - `checkNicknameAvailability` (`src/lib/services/profile.services.ts`) —
    the satellite availability query (live probe + claim-time re-check).
  - `HANDLE_POOL` (`src/lib/constants/handle-pool.constants.ts`) — the
    Roman/Latin suggestion pool; the app equivalent of the prototype's
    `OB3_POOL`, already availability-pre-filtered by Beat 2's `reshuffle`.
  - `sanitizeNickname`, `NICKNAME_PATTERN`, `MIN_NICKNAME_LENGTH`,
    `MAX_NICKNAME_LENGTH`, `RESERVED_HANDLES`, `PENDING_ONBOARDING_STORAGE_KEY`
    (`src/lib/constants/profile.constants.ts`).
  - `applyOnboardingPicks` (`src/lib/services/profile.services.ts`) — the
    serialized profile write the handoff already uses.
- Starter-pack VXP: `newUserVxpAmountMilestone1BaseUnits()`
  (`src/lib/constants/vxp-onboarding.constants.ts`) formatted via
  `formatVxpBalance` — reused so the "1,500 VXP" chip stays in lock-step
  with the economy config rather than hardcoding the literal.
- Feature-flag mechanism: build-time boolean constants in
  `src/lib/constants/feature-flags.constants.ts` (e.g.
  `MARKET_DETAIL_DIRECT_TRADE_ENABLED`). This is the app's only flag
  idiom — hardcoded booleans flipped through review, not runtime config.
- i18n: flat dotted keys in `src/lib/constants/messages/*.ts` (en, it, fr,
  de, es, pt-BR), looked up via `t({ locale, key })`
  (`src/lib/utils/i18n.utils.ts`). Existing namespace: `onboarding.*`.
- Onboarding handoff / persistence (the dependency below):
  `src/lib/services/onboarding-handoff.services.ts` (`drainPendingOnboarding`),
  `src/routes/(app)/+layout.svelte` (the drain effect), the
  `applyOnboardingPicks` write, governed by
  `specs/2026-06-18-fix-onboarding-picks-persist-across-providers.md`.

### Prototype side (React, source of truth — port behaviour/UI/copy, not code)

`/tmp/.../proto/VICI-V1.8-Handover/`:

- `onboarding-v3.jsx` — `OnboardingFlowV3`: the single screen. Brand
  wordmark → hero (`Claim your handle.`) → handle field with live
  availability + auto-suggested fallback → reward chip → lock cue → auth
  (`Continue with Google`, `Continue with email` → email→passkey
  sub-mode) → `Skip — preview first, sign-up later` → `Already a member?
  Sign in` → legal fine print.
- `onboarding-v3.css` — scoped under `.ob-v3`, theme-aware tokens
  (`--bg`, `--fg`, `--accent`, …), light/peach overrides for the Google
  pill. Two themes minimum (dark + light/peach).
- Prototype flag `onboardingV3` (default `true`), gated in `app.jsx`
  (`t.onboardingV3 && window.OnboardingFlowV3 ? V3 : V2`) — V3 runs
  side-by-side with V2.
- 22 `obv3.*` i18n keys, all six locales, in `i18n.js` (en/it/fr/de/es)
  and `i18n-extra.js` (pt-BR). Reference copy for the `obv3.*` set.
- CHANGELOG: V1.8.6–8 (V3 birth), V1.8.17–18 (i18n wiring + 6 locales),
  V1.8.19 (both-paths QA), V1.8.20–23 (Google-pill contrast fixes),
  V1.8.34–39 (A2HS + guest funnel — out of this spec). The CTO header's
  domain-1 scopes this to the V3 onboarding screen only.

### Reusability

Per `docs/ai/frontend/reusability.md`: the handle field, pool
suggestions, live availability, and claim-time re-check already exist in
`OnboardingBeat2.svelte`; the auth cluster in `SignInProviderStack.svelte`;
the starter VXP in `vxp-onboarding.constants.ts`. V3 is a re-composition
of these into one screen, not new infrastructure. Country flags use
`CountryFlag.svelte` (no emoji); icons are lucide (`Gift`, check/x marks),
not the prototype's inline SVGs or emoji.

## Scope

A new single-screen V3 onboarding component, gated by a new build-time
flag, mounted by `signup/+page.svelte` in place of `OnboardingFlow` when
the flag is on. V2 stays in the tree, reachable when the flag is off.

### 1. The V3 screen

New `src/lib/components/onboarding/OnboardingV3.svelte`, structured per
`onboarding-v3.jsx` and styled per `onboarding-v3.css` (theme-aware
tokens, dark + light/peach), IA order: brand → hero → handle → reward →
auth → escapes → legal.

- **Handle field** — a single typed input (the prototype's `.sl-namefield`),
  not the V2 pool/custom tab split. Live availability uses the same
  debounced probe pattern as `OnboardingBeat2` (`checkNicknameAvailability`,
  monotonic cancel token, `sessionTaken` cache, offline-tolerant `failed`
  state stays claimable-but-neutral). Validation reuses
  `MIN_NICKNAME_LENGTH` / `MAX_NICKNAME_LENGTH` / `NICKNAME_PATTERN` /
  `sanitizeNickname` and screens `RESERVED_HANDLES`. The check/x state
  marks rendered with lucide icons. On empty input, the placeholder shows
  a pool-derived suggestion (`@<HANDLE_POOL pick>`), mirroring the
  prototype's `ob3Suggest` fallback; selecting it claims it. A
  claim-time re-check (Beat 2's TOCTOU guard) runs before the picked
  handle is handed to the auth/stash path.
- **Reward chip** — "1,500 VXP starter pack" + "Predict the FIFA World
  Cup 2026" sub. VXP from `newUserVxpAmountMilestone1BaseUnits()` via
  `formatVxpBalance`; event title from `$featuredEvent`. lucide `Gift`
  (or equivalent), no emoji.
- **Auth** — mount `SignInProviderStack mode="signup" handle={handle}`.
  The prototype shows Google + email→passkey; the app's stack already
  renders Google (cream primary), email→passkey, Apple, passkey, II
  (prod-gated), dev. Reuse the stack rather than re-creating the
  prototype's two-button subset — its provider set is the app's
  authority and already carries the redirect-safe stashing. The "lock
  cue" (`Locking @handle` / `Enter an available handle to continue`)
  ports as a label above the stack.
- **Escapes & footer** — "Skip — preview first, sign-up later" (hands off
  to guest mode, see Dependencies), "Already a member? Sign in" link
  (routes to `/signin`), and the legal fine print ("VXP is game play
  currency · no real money" / "Resolution on public data") — no gambling
  vocabulary, no "bet".

### 2. Wire into `signup/+page.svelte`

- Gate on the new flag: render `OnboardingV3` when on, `OnboardingFlow`
  (V2) when off. The authenticated post-signin path and the returning-user
  bounce stay as-is.
- V3 emits the **same handoff shape** the page already consumes —
  `{ participantId: null, side: null, handle }` — so
  `handleCompletePreAuth` / `handleCompleteAuthenticated` /
  `onPicksReady` need **no signature change**: team and side are simply
  always `null` for V3 (deferred to Profile). The persist-across-providers
  machinery (stash-before-auth, drain, analytics) is reused unchanged.
- Emit `onPicksReady` (handle-only) when the user is on the V3 screen with
  a claimed handle, before any provider runs — so a Google redirect
  carries the handle through, exactly as V2's Beat-3 entry does today.

### 3. New flag

Add to `src/lib/constants/feature-flags.constants.ts`, e.g.
`ONBOARDING_V3_ENABLED = true` (default on, matching the prototype), with
a doc comment noting V2 is kept behind the off path until V3 is verified
in prod. (Exact name/placement under Pending decisions.)

### 4. i18n — the 22 `obv3.*` keys, app namespace

Port the 22 prototype `obv3.*` keys into the app's `onboarding.*`
namespace (e.g. `onboarding.v3.h1_pre`, `onboarding.v3.avail`,
`onboarding.v3.err_taken`, …) across all six locales (en, it, fr, de, es,
pt-BR) in `src/lib/constants/messages/*.ts`, reusing the prototype's
reference copy. Keep the app's namespace convention — do **not** adopt the
prototype's bare `obv3.*` prefix. Reuse existing `onboarding.*` strings
where the copy already matches rather than duplicating.

### Out of scope

- **Guest mode ("Model B" funnel).** The Skip path hands off to it but it
  is a separate spec — see Dependencies. V3 only wires the entry point.
- **Sign-in / auth re-skin** (`/signin`, the V1.8.24–28 sign-in rework) —
  a separate spec. V3 only links to `/signin`.
- **A2HS install nudge** (V1.8.34) and the guest save-sheet / convert
  flow (V1.8.35–39) — separate work.
- **Deleting V2.** V2 stays in the tree, reachable with the flag off,
  until V3 is verified in prod. The cleanup PR is a later follow-up (see
  Pending decisions).
- **Team selection in onboarding.** Deferred to the post-signup Profile
  (Affiliations) — V3 is handle + auth only. Building the Profile-side
  team entry point is its own work, not this spec.
- **The satellite write path / schema / handle-uniqueness assertion** —
  already correct and unchanged; V3 reuses `checkNicknameAvailability` and
  `applyOnboardingPicks` with team/side `null`.
- **Anti-farm gating of the onboarding VXP grant** (issue #543) —
  untouched.

## Linked issues

No open issue tracks this work. Searched the repo's open issues
(`onboarding`, `handle`, `signup`, `signin`, `guest`): only #543
(anti-farm gating of onboarding/referral payouts) is adjacent, and it is
explicitly out of scope (no closing keyword). New feature, no closing
keyword. Searched 2026-06-25.

## Analytics

Onboarding is already instrumented; V3 reuses the existing taxonomy
(`src/lib/types/analytics-event.ts`, mirrored in
`src/lib/schema/analytics-event.schema.ts`) — **no new event names, no new
prop keys**, so no dual-source union/Zod edit and no satellite
analytics-wire regen.

- `onboarding_started` — emit on V3 mount, `source: 'onboarding'`,
  `label: 'v3'` to distinguish the surface from V2. (`label` is the
  bounded categorical dimension; `'v3'` is a fixed value.)
- `handle_checked` — emit on a completed live availability probe (custom
  typed handle), carrying `ok` (available?). Mirrors Beat 2's custom-mode
  check; the pool-fallback placeholder doesn't fire it.
- `onboarding_completed` — **not added here.** It already fires once in
  the drain's `applied` outcome
  (`onboarding-handoff.services.ts`, per the persist spec), the single
  point every completed flow passes through, carrying the finishing
  `provider` (`label`) and team-picked (`ok`). For V3 the team is always
  absent, so `ok` is `false` — a correct, expected signal, not a new
  event. The Skip→guest path does **not** complete onboarding here; its
  conversion analytics belong to the guest-mode spec.

All events behavioural, bounded vocab, no PII/free-text. Capture via
`track()` (`src/lib/services/analytics.services.ts`).

## Implementation outline

1. Add `ONBOARDING_V3_ENABLED = true` to
   `src/lib/constants/feature-flags.constants.ts` with the V2-retention
   doc comment.
2. Add the 22 `onboarding.v3.*` keys to all six locales in
   `src/lib/constants/messages/*.ts`, porting the prototype `obv3.*`
   reference copy (en/it/fr/de/es from `i18n.js`, pt-BR from
   `i18n-extra.js`). Run `npm run quality` so the i18n lint catches any
   missing-locale gaps.
3. Create `src/lib/components/onboarding/OnboardingV3.svelte`
   (Svelte 5 runes, `interface Props` + destructure):
   - Props: `onComplete`, `onPicksReady`, `onSignIn`, `onSkip`,
     `authenticated?` (mirroring the V2 flow's contract, team/side
     always `null`).
   - Handle state + the debounced live-availability `$effect` ported
     from `OnboardingBeat2` (`checkNicknameAvailability`, monotonic
     token, `sessionTaken` `SvelteSet`, `failed` → neutral-claimable),
     plus `RESERVED_HANDLES` screening and the empty-input pool-suggestion
     placeholder from `HANDLE_POOL`.
   - Reward chip from `newUserVxpAmountMilestone1BaseUnits()` +
     `$featuredEvent`; lucide `Gift`.
   - Mount `SignInProviderStack mode="signup" handle={handle}
     onSuccess={...}`; lock-cue label above it.
   - Claim-time re-check before handing the handle to the stash/complete
     path (Beat 2's TOCTOU guard).
   - Skip button → `onSkip`; "Already a member?" → `onSignIn`; legal
     fine print.
   - Scoped `.ob-v3` styles ported from `onboarding-v3.css`, using the
     app's theme tokens; verify dark + light/peach (the V1.8.20–23
     Google-pill contrast fix must survive the port).
4. `signup/+page.svelte`: import `ONBOARDING_V3_ENABLED`; render
   `OnboardingV3` when on, `OnboardingFlow` when off. Pass
   `onComplete={handleComplete}`, `onPicksReady={handleCompletePreAuth}`,
   `onSignIn={() => goto('/signin')}`, and `onSkip` → the guest-mode
   entry (placeholder until the guest-mode spec lands; until then route to
   `/signin` or no-op per Pending decisions). Confirm the handoff shape
   (`participantId`/`side` always `null`) flows through unchanged.
5. Analytics: emit `onboarding_started` (`label: 'v3'`,
   `source: 'onboarding'`) on mount and `handle_checked` (`ok`) on a
   completed custom-handle probe, via `track()`.
6. Update `docs/ai/PRODUCT.md` onboarding section: V3 is the default flow
   (one screen, handle + auth, team deferred to Profile, first prediction
   free in-app), V2 retained behind the flag, the persist machinery and
   `onboarding_completed` emit unchanged.
7. `npm run quality` + `npm run check`.

## Acceptance criteria

- [ ] With `ONBOARDING_V3_ENABLED` on, `/signup` renders the single V3
      screen — no team picker, no first-call beat, no step tracker.
- [ ] Typing a handle runs the live availability check (debounced,
      cancel-on-keystroke) and shows available / taken / format-error /
      reserved states; an empty field shows a Roman-pool suggestion as a
      claimable placeholder.
- [ ] The reward chip shows the starter VXP sourced from
      `newUserVxpAmountMilestone1BaseUnits()` (not a hardcoded literal)
      and the featured-event title.
- [ ] Signing up with any enabled provider lands the claimed handle on
      the new profile (team/side `null`), via the existing
      persist-across-providers stash + drain — including a Google
      full-page redirect.
- [ ] "Skip — preview first, sign-up later" hands off to the guest-mode
      entry point (or the agreed interim target until that spec lands).
- [ ] "Already a member? Sign in" routes to `/signin`.
- [ ] The screen renders correctly in dark and light/peach themes; the
      Google CTA is a dark-ink pill with white text in light/peach (no
      cream-on-cream, no transition flash).
- [ ] All 22 `onboarding.v3.*` keys resolve in en, it, fr, de, es, pt-BR;
      no gambling vocabulary, no "bet", no emoji.
- [ ] `onboarding_started` (`label: 'v3'`) and `handle_checked` (`ok`)
      fire; `onboarding_completed` still fires once via the drain with the
      finishing provider.
- [ ] Flipping `ONBOARDING_V3_ENABLED` off restores the intact V2 flow.
- [ ] `npm run quality` and `npm run check` pass.

## Open questions

- **How does onboarding handoff/persistence behave with a handle-only
  payload?** The persist spec
  (`specs/2026-06-18-fix-onboarding-picks-persist-across-providers.md`,
  In progress #926) stashes `{ participantId, side, handle }` and the
  drain applies them on the new-user branch. Confirm a payload with
  `participantId: null` + `side: null` + a non-null `handle` drains
  cleanly: `applyOnboardingPicks` writes the handle and stamps
  `onboardingCompleted` without a team/side, `handleCompletePreAuth`'s
  "nothing to stash" guard still fires only when the handle is also absent,
  and `onboarding_completed`'s `ok` (team-picked) reads `false` rather
  than erroring. Verify against the #926 code as merged, not the V2
  assumption.
- **Is `OnboardingV3` better as a sibling of `OnboardingFlow` or rendered
  through it?** V3 has no beats, so a standalone component mounted by the
  page (bypassing the `1a→3` state machine) is the natural shape — but
  confirm nothing downstream (FlowCoach trigger, the `(app)` drain,
  `data-tid` hooks used by e2e) depends on the `OnboardingFlow` wrapper
  element / `.ob.ob-v2` envelope being present.

## Pending decisions

- **Exact flag name + placement.** `ONBOARDING_V3_ENABLED` in
  `feature-flags.constants.ts` is proposed (the app's only flag idiom —
  build-time boolean). Confirm the name and whether default-on at first
  ship matches the rollout appetite, given real auth + handle-uniqueness
  are now server-backed (the prototype's V1.8.19 blocker is resolved in
  the app).
- **V2 → V3 cutover / cleanup plan.** This spec ships V3 flag-gated with
  V2 retained. Decide the trigger to flip the flag permanently and the
  follow-up PR that deletes V2 (`OnboardingFlow`, `OnboardingBeat1/1Card/2/3`,
  `OnboardingStepTracker`, the V2-only `onboarding.beat*` i18n keys and
  `.ob-v2` styles) — owner + timing, not built here.
- **Interim Skip target until the guest-mode spec lands.** If V3 ships
  before guest mode, the Skip button needs a temporary destination
  (route to `/signin`, or hide Skip behind the guest-mode flag). Decide
  which, so V3 never ships a dead button.

## Decisions

- **Ship V3 flag-gated, default on; keep V2 reachable.** V2 is not deleted
  in this spec — it stays behind the off path until V3 is verified in
  prod, so a regression is a one-line flag flip back, not a revert. The
  app's `feature-flags.constants.ts` build-time-boolean idiom is the
  vehicle (review-gated, no runtime config), matching the prototype's
  `onboardingV3` default-on tweak.
- **Defer team selection to the post-signup Profile.** Prototype parity
  (V1.8.6–8, V1.8.19): V3 is handle + auth only. The first prediction is
  now free in-app (Option-A economy), so the in-onboarding team pick and
  first call are dropped; team affiliation moves to Profile → Affiliations.
  The handoff shape is unchanged — `participantId`/`side` are simply always
  `null` — so the persist-across-providers machinery is reused verbatim.
- **Keep the app's i18n namespace.** The 22 keys land under
  `onboarding.v3.*`, not the prototype's bare `obv3.*`, per the project's
  namespace convention.
- **Reuse, don't re-implement, the handle + auth machinery.** The live
  availability probe, pool suggestions, claim-time TOCTOU re-check
  (`OnboardingBeat2`), the provider stack (`SignInProviderStack`), the
  starter-VXP source (`vxp-onboarding.constants.ts`), and the
  persist-across-providers stash/drain are all reused — V3 is a
  re-composition into one screen, keeping a single source of truth for
  each behaviour.

## Dependencies

- **Guest mode (`specs/2026-06-25-feat-guest-mode.md`, separate spec).**
  The Skip → "preview first, sign-up later" path is the entry point into
  the guest funnel; V3 wires the button, guest mode owns the funnel. If
  V3 ships first, see the interim-Skip-target pending decision.
- **Sign-in re-skin (separate spec).** "Already a member? Sign in" links
  to `/signin`; the sign-in screen's V3-matching re-skin (V1.8.24–28) is
  its own spec. V3 only depends on `/signin` existing.
- **Onboarding picks persist across providers
  (`specs/2026-06-18-fix-onboarding-picks-persist-across-providers.md`,
  In progress #926).** V3 reuses its stash-before-auth + drain + the
  single `onboarding_completed` emit. The first Open question must be
  confirmed against #926 as merged.
