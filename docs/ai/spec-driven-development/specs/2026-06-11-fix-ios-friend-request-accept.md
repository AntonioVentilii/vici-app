# Spec: Recipient cannot accept an incoming friend request (iOS)

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: In progress (PR pending)

## Goal

A user who receives a friend request can accept it from their device and
reliably become friends — including on iOS Safari, where the original
report originated. The recipient should land on the Accept affordance
with one tap from the inbox notification, see a clear confirmation on
success, and a real, actionable error on failure. The flow is covered by
a regression test so it cannot silently break again.

## Context

Reported as
[#803](https://github.com/AntonioVentilii/vici-app/issues/803): an iOS
recipient taps an incoming friend request and "nothing happens" — the
exact symptom in the attached screenshot, where `@Giovanni`'s request
shows a `WAITING` label and no obvious way to accept.

The real code path, end to end, is **sound on the server**:

- FE mutation `acceptFriendRequest`
  (`src/lib/services/relation.services.ts`) calls the satellite endpoint
  with `relationId: currentRelation.key`.
- The key is reconstructed in
  `src/lib/services/relation-queries.services.ts`
  (`getFriendRequests`) as `[...participants].sort().join('#')`, which
  matches the doc key the satellite writes in `sendFriendRequest`
  (`src/satellite/services/relation.services.ts`,
  `[sender, target].sort().join('#')`).
- The satellite `acceptFriendRequest`
  (`src/satellite/services/relation.services.ts`) authorizes the caller
  as the recipient via `relation.participants[1] === callerText`
  (participants are stored unsorted as `[sender, target]`), then flips
  `state` to `RelationState.ACTIVE`
  (`src/lib/enums/relation.ts`).
- The `relations` collection is `write: 'public'`
  (`juno.config.ts`), so the recipient is permitted to update a doc the
  sender created. No permission trap.

So the defect was **not** server logic — it was that the Accept/Reject
controls were undiscoverable. Pre-fix, an incoming request rendered as a
collapsed `<button class="pending-row">` whose only label was the same
`WAITING` vocabulary used by the _outgoing_ requests section; Accept and
Reject lived behind a tap-to-expand step. On iOS a tap consumed by
scroll-stop looked like dead UI.

### What already landed (and what it left open)

[#809](https://github.com/AntonioVentilii/vici-app/pull/809) replaced the
tap-to-expand row in
`src/lib/components/arena/FriendsTab.svelte` with **inline** Accept/Reject
pills, removed the `WAITING`/`Close` state label and its i18n keys across
all catalogs, added a success toast (`arena.friends.accept.success`), and
split accept/reject error copy (`arena.friends.error.accept_failed` /
`reject_failed`). That is the correct UI fix.

Two things #809 did **not** do, and this spec closes:

1. **It is unreleased.** The latest tag is `v0.1.5`
   (`.release-please-manifest.json`, `CHANGELOG.md`); #809 sits above it
   on `main`. Production is still serving the pre-fix `WAITING` build —
   which is why the reporter still sees it. The fix must ride the next
   release.
2. **No regression coverage and no deep-link.** #809 shipped no test, and
   the `friend_request` inbox notification still routes to a bare
   `AppPath.Arena` (`src/lib/constants/notification-kind.constants.ts`)
   with no anchor — the recipient lands on the Arena page and must still
   hunt for the request among other surfaces. The "nothing happens"
   complaint was partly about not finding the control at all; a generic
   route doesn't fully close that.

## Scope

1. **Deep-link the inbox notification to the pending request.** Give the
   `friend_request` notification a concrete destination that opens the
   Friends surface scrolled to (and briefly highlighting) the incoming
   request, instead of a bare `/arena`.
2. **Surface the real failure.** On accept/reject failure, include the
   underlying satellite error (trap message) in the toast or console in a
   way a future iOS report can be diagnosed from, rather than only the
   generic `accept_failed` copy.
3. **Regression coverage.** The dev e2e identity (`signIn({ dev: {} })`)
   mints a fresh random principal each run (`e2e/auth.spec.ts`), so a
   deterministic two-user send→accept flow isn't feasible in the harness.
   Instead, add a Playwright e2e (`e2e/`) that signs in and asserts the
   `?request=` deep-link opens the Friends tab — the new routing this
   spec adds — and document the full send→accept path as a manual repro
   in the PR body, the accepted norm for this repo when automation isn't
   feasible (`docs/ai/frontend/testing.md`: "Bug fixes still benefit from
   a manual repro"). E2E is the only CI-required test layer; there is no
   unit runner yet.
4. **Release.** Ensure #809 + this change land in the next tagged release
   so the reporter actually receives the fix.

### Out of scope

- The satellite accept/reject/cancel logic, the `relations` collection
  rules, the doc-key scheme, and the auto-accept-on-mutual-request
  shortcut in `sendFriendRequest` — all verified correct, untouched.
- The inline-button UI itself — already shipped in #809; this spec does
  not re-do it.
- Any redesign of the Friends surface or the invite hero.

## Design artifacts (frontend — optional)

None. The visual change (inline pills) already shipped in #809; this spec
is routing, diagnostics, and test hardening.

## Technical requirements (satellite / backend — mandatory)

No satellite, collection, or icdc-core change. The accept/reject/cancel
endpoints, the `relations` collection rules (`write: 'public'`,
`juno.config.ts`), and the generated `.did` surface are all unchanged, so
there is no new instruction-budget, memory, scalability, upgrade, or
security impact. The `relations` doc shape and growth are unaffected. If
implementation reveals a genuine need to touch `src/satellite/**`, this
section must be filled in with numbers before building continues.

## Implementation outline

1. **Notification destination.** In
   `src/lib/constants/notification-kind.constants.ts`, give
   `friend_request` a destination that lands on the Friends surface with
   an anchor (e.g. an `href` of `/arena` plus a query/hash the Friends
   view reads), using the existing `notificationDestination` `href`
   branch rather than adding a new routing concept.
2. **Friends view anchor.** In
   `src/lib/components/arena/FriendsTab.svelte` (rendered by
   `src/lib/components/pages/ArenaPage.svelte`), read the anchor on mount
   and, when the matching `pendingReceived` row exists, scroll it into
   view and apply a short highlight. Reuse existing scroll/`onMount`
   patterns; check `docs/ai/frontend/reusability.md` before adding any
   helper.
3. **Diagnostic error.** In `handleAccept` / `handleReject`, keep the
   user-facing `accept_failed` / `reject_failed` toast but also log the
   caught error with enough context to diagnose (already `console.error`
   today — confirm the satellite trap message survives the
   `functions.*` round-trip and isn't swallowed).
4. **Regression test.** Add `e2e/pages/*` + a spec under `e2e/` following
   the conventions in `docs/ai/frontend/testing.md` and the existing
   `e2e/invite.spec.ts` / `e2e/navigation.spec.ts`. Prefer the full
   accept path; fall back to a rendered-control assertion if a second
   authenticated identity isn't available in the harness.
5. **i18n.** Any new user-visible string goes through `t(...)` and is
   added to **every** catalog under `src/lib/constants/messages/`
   (`AGENTS.md` §3); run `npm run check:i18n`.
6. **Release.** Confirm the change is on `main` ahead of the next
   release-please cut so it ships with #809.

## Acceptance criteria

- [ ] Tapping a `friend_request` inbox notification lands the recipient on
      the Friends surface with the matching incoming request scrolled into
      view and momentarily highlighted.
- [ ] The recipient can accept the request inline and sees the
      `arena.friends.accept.success` confirmation; the relation appears in
      Friends and is gone from incoming requests after refresh.
- [ ] An accept/reject failure surfaces the underlying satellite error for
      diagnosis (toast copy unchanged; real cause logged/inspectable).
- [ ] A Playwright e2e asserts the `/arena?request=<key>` deep-link opens
      the Friends tab; the full send→accept path is documented as a manual
      repro in the PR body.
- [ ] No new user-visible strings are introduced (deep-link + highlight
      carry no copy), so the locale catalogs are unchanged;
      `npm run check:i18n` still passes.
- [ ] `npm run quality` and `npm run check` pass.
- [ ] The fix is queued for the next tagged release (above `v0.1.5`).

## Decisions

- **Harden vs. re-open the UI.** #809 already fixed the discoverability
  root cause correctly; re-doing it would churn. This spec treats #809 as
  landed and closes only what it left open: release, deep-link, error
  visibility, and a regression test. Chosen: harden around #809.
- **Deep-link via the existing `href` branch vs. a new routing concept.**
  `notificationDestination` already supports an explicit `href`; reusing
  it keeps the notification config the single source of truth
  (`notification-kind.constants.ts`) instead of introducing a parallel
  deep-link mechanism. Chosen: reuse `href`.
- **E2E vs. unit regression.** The repo has no unit runner; Playwright is
  the CI-required layer (`docs/ai/frontend/testing.md`). A two-identity
  send→accept flow is the truest test, but the dev sign-in mints a random
  principal per run (`e2e/auth.spec.ts`), so it can't deterministically
  seed an incoming request without harness work out of scope here. Chosen:
  e2e-guard the new deep-link routing (deterministic), and document the
  send→accept path as a manual repro — the repo's stated norm for
  un-automatable bug fixes.
