# Spec: League invite implies a friend invite

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

Inviting someone to your league should, by default, also invite them
to be your friend. When a person joins a league through an invite link
that you shared, they auto-friend **you** (the sharer), and — if they
are a brand-new sign-up — the same new-user referral bonus that a plain
friend invite grants applies too. One link, two outcomes: they land in
the league *and* in your friend graph.

## Context

The two systems already exist and overlap cleanly; this change wires
the league invite to ride the existing referral rails rather than
building new friendship/payout logic.

**League invite (today):**

- Share links are built as `${origin}/league/${league.inviteCode}` in
  `src/lib/components/leagues/LeagueListCard.svelte:144` and
  `src/lib/components/pages/LeagueDetailPage.svelte:475`. The code maps
  to a *league*, never to the person who shared it.
- The landing route is `src/routes/league/[code]/+page.svelte`. It
  validates the slug (`LEAGUE_INVITE_CODE_REGEX`), then: signed-out /
  mid-onboarding → `stashCodeForSignup()` writes `leagueInvite` into the
  `vici:pending-onboarding` slot and routes to `/signup`; signed-in
  returning user → `lookupLeagueByInvite()` + `joinLeagueByInvite()` and
  routes into the league. This route sits **outside** the `(app)` route
  group.

**Friend invite / referral (today) — the rails we reuse:**

- Every profile gets an 8-char referral code on creation
  (`assignReferralCodeIfMissing` in
  `src/satellite/services/referral.services.ts`); the FE reads it via
  `getMyReferralCode()` (`src/lib/services/referral.services.ts:18`).
- `src/lib/components/market/SharePopover.svelte` already appends the
  sharer's code as `?ref={code}` to share URLs (`refToken = code ?? handle`).
- `src/routes/(app)/+layout.svelte:104-165` is a **global `?ref=`
  capture**: any arriving visitor with a valid `?ref=` code has it
  stashed into `vici:pending-onboarding.referralCode` (first-referrer-
  wins; never overwritten), and the post-signin **drain**
  (`drainPendingOnboarding` /
  `redeemPendingReferralIfAny` in
  `src/lib/services/onboarding-handoff.services.ts`) redeems it.
- Redemption reuses the satellite endpoints unchanged: new sign-up
  within the signup window → `redeemReferralCode()` (bilateral
  confirmed friendship + **deferred** new-user VXP bonus, settled on the
  referee's first prediction); otherwise → `claimReferralFriendship()`
  (friendship only, no bonus). The bonus amount and signup window are
  the existing constants in `src/lib/constants/referral.constants.ts`.

Because the `?ref=` capture already lives in the `(app)` layout, the
only gaps are: (1) league share links don't carry the sharer's code,
and (2) the `/league/[code]` landing is outside `(app)`, so the global
capture never runs there.

## Scope

1. **League share links carry the sharer's referral attribution.** In
   `LeagueListCard.svelte` and `LeagueDetailPage.svelte`, fetch the
   sharer's code via `getMyReferralCode()` and append `?ref={token}` to
   the `/league/${inviteCode}` URL, mirroring `SharePopover`
   (`token = code ?? handle`). If no code resolves, fall back to the
   plain link (backward-compatible).
2. **The league landing captures `?ref=`.** In
   `src/routes/league/[code]/+page.svelte`, read
   `page.url.searchParams.get('ref')`, validate with
   `REFERRAL_CODE_REGEX`, and stash it into
   `vici:pending-onboarding.referralCode` for **all** branches
   (mirroring the `(app)` layout's first-referrer-wins rule). The
   existing drain then redeems it: the signup branch via the signup
   drain, the signed-in immediate-join branch via the `(app)` layout
   drain once the user routes into `/app/...`. This couples the
   friendship to the act of joining (the user only reaches these
   branches by acting on the league link).
3. **Friendship fallback covers the "already referred" case.** A user
   who already redeemed a referral (came via a friend invite first) and
   then joins a league via someone else's link should still become
   friends with the league sharer. Confirm the drain falls back to
   `claimReferralFriendship()` not only on `REFERRAL_EXISTING_USER_REASON`
   but also on the "already redeemed" error; add the fallback if missing.

### Out of scope

- **No opt-out toggle.** "By default" is read as the standard implied
  behaviour, not a per-invite switch. A "don't also add as friend"
  option can be a fast-follow.
- **Auto-friending the league owner or all current members.** This
  spec friends the *sharer* only (the person whose link was used), per
  the product decision. A group-wide friend graph is a separate idea.
- **Any change to the referral payout amount, signup window, cap
  curve, or the satellite referral/friendship endpoints.** Those rails
  are reused verbatim.
- **The `lookupLeagueByInvite` reverse-index optimisation** noted in
  `cohort.services.ts` — unrelated.

## Linked issues

No open issue tracks this. (Open issues reviewed: #810 GDPR, #759 Dash
parity, #543 anti-farm referral gating, #350 flow-grant credit — none
related. Note: #543's concern, that payouts gate on the client-written
activity log rather than an authoritative trade, applies equally to
this path since it reuses the same payout machinery; this spec does not
widen or narrow that surface.)

## Analytics

Instrument by reusing existing taxonomy — no new event names, so no
dual-source (`analytics-event.ts` + `analytics-event.schema.ts`) change.

- `league_invite_sent` — already fired when a league link is shared.
  Add the `ok` boolean prop to mark whether the link carried a friend
  attribution (`ok: true` when a `?ref=` token was appended), so we can
  measure adoption of the implied-friendship path.
- `referral_redeemed` — already fires from the drain when the stashed
  code is redeemed; set its `source` prop to `'league_invite'` (vs.
  `'market_share'` / `'invite_landing'`) so league-originated
  friendships are attributable in the funnel.

No new dimensions needed; `ok` and `source` already exist in
`AnalyticsEventProps`. Behavioural only — no PII (the referral code is a
pseudonymous opaque token, not personal data).

## Technical requirements (no satellite / backend change)

This is a **pure-frontend** spec. It adds no collection, doc shape,
hook, endpoint, or schema, and regenerates no bindings — it reuses the
existing `redeemReferralCode` / `claimReferralFriendship` endpoints and
the `?ref=` capture/drain unchanged. The only parameters touched are
the existing referral constants in
`src/lib/constants/referral.constants.ts` (cited, not restated).

## Implementation outline

1. `src/lib/components/leagues/LeagueListCard.svelte` — in `handleCopy`,
   resolve the sharer's `getMyReferralCode()` (fall back to handle),
   append `?ref={token}` to the share URL. Cache the lookup so repeated
   copies don't refetch.
2. `src/lib/components/pages/LeagueDetailPage.svelte` — same change in
   its share handler (line ~475).
3. `src/routes/league/[code]/+page.svelte` — add a `?ref=` read +
   `REFERRAL_CODE_REGEX` validation + first-referrer-wins stash into
   `vici:pending-onboarding.referralCode`, applied before every navigate
   branch in `handleInvite` (extend `stashCodeForSignup`, or a sibling
   helper, to also persist `referralCode`).
4. `src/lib/services/onboarding-handoff.services.ts` — verify (and if
   needed extend) the drain's referral error handling so the
   "already redeemed" error also falls back to
   `claimReferralFriendship()`, and pass `source: 'league_invite'` when
   the redemption originated from a league invite.
5. i18n — reuse existing `onboarding.handoff.referral_*` and
   `league_invite.*` keys; add a key only if a league-specific success
   toast is warranted (decide during build — default to reuse).

## Acceptance criteria

- [ ] A league share link copied from a card or the league detail page
      includes the sharer's `?ref=` code (or omits it gracefully when no
      code is available).
- [ ] A brand-new user who signs up via a league invite link joins the
      league **and** becomes a confirmed friend of the sharer, **and**
      the new-user referral bonus is owed (settling on their first
      prediction) — same outcome as a plain friend invite.
- [ ] An existing user (past the signup window) who joins a league via
      an invite link becomes a confirmed friend of the sharer with no
      VXP bonus.
- [ ] A user who already redeemed a referral and then joins a league via
      a different sharer's link still becomes friends with that sharer.
- [ ] A plain `/league/{code}` link with no `?ref=` still joins the
      league exactly as before (no friendship, no regression).
- [ ] A self-shared link (sharer === joiner) is a harmless no-op (the
      satellite rejects self-referral).
- [ ] `league_invite_sent` carries `ok` and league-originated
      `referral_redeemed` carries `source: 'league_invite'`.
- [ ] `npm run quality` and `npm run check` pass. (No
      `npm run juno:functions:build` — satellite untouched.)

## Open questions

- Does `drainPendingOnboarding` currently fire for an **already-
  onboarded returning** user who has just stashed a `referralCode` on
  the league landing and then navigates into `(app)` (the signed-in
  immediate-join branch)? The `(app)` layout comment implies yes (it
  credits share-link `?ref=` for arriving visitors via the same
  stash+drain), but this must be confirmed at build time — if the drain
  only runs for fresh sign-ups, the signed-in branch must call the
  referral flow directly after a successful `joinLeagueByInvite()`
  instead of relying on the drain.
- Does the drain already fall back to `claimReferralFriendship()` on the
  "already redeemed" error (scope item 3), or only on
  `REFERRAL_EXISTING_USER_REASON`? Confirm and extend if needed.

## Pending decisions

None — the friend target (the link's sharer) and the no-opt-out default
are decided (see Decisions).

## Decisions

- **Friend the link's sharer, not the league owner or all members.**
  The sharer's identity is carried by embedding *their* referral code
  in the link they generate, so "whoever shared the link" is exact and
  needs no per-league ownership lookup. (Chosen over "league owner",
  which would mis-attribute when a non-owner member shares, and over
  "all current members", which would fan out unbounded friendship
  writes per join.)
- **Reuse the referral rails wholesale instead of a new league-
  friendship path.** The `?ref=` capture, redeem/claim endpoints, and
  deferred-bonus settlement already encode the exact "auto-friendship +
  new-user bonus" semantics requested. Piggybacking the sharer's code on
  the league link means zero satellite change and one tested payout
  path, at the cost of the league link gaining a query param.
- **No opt-out toggle in v1.** "By default" reads as the standard
  behaviour; an explicit opt-out is a possible fast-follow, not a
  blocker.
