# Spec: Leagues privacy as radio visibility cards (3-tier)

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

Replace the cramped privacy picker in the league create + edit sheets
with radio **visibility cards** that name each visibility tier and
explain it inline. Today the create sheet renders three tight
segmented buttons (`Private` / `Invite-only` / `Open`) with no
explanation, so the owner has to already know what each means; the edit
sheet already shows a label + description per row but as a plain list.
This spec ports the prototype's `.league-vis-card` UI — radio dot,
title, inline description — to the create sheet and aligns the edit
sheet to the same card visual, **keeping the app's three visibility
tiers** (the prototype's UI is adopted, its 2-tier model is not). Pure
frontend; no data-shape, satellite, or copy-meaning change.

## Context

The app keeps a **three-tier** visibility model — Open / Invite-only /
Private — resolved through one source of truth in
[`src/lib/types/league.ts`](../../../../src/lib/types/league.ts):
`leaguePrivacy`, `isLeaguePubliclyListed` (Open only), and
`isLeagueRecommendableToFriends` (Open + Invite, not Private). The
middle tier is load-bearing, not cosmetic:

- **Battles gate to Open.**
  [`src/satellite/services/battle.services.ts`](../../../../src/satellite/services/battle.services.ts)
  `isLeagueOpen` restricts battle eligibility to Open leagues — Invite
  and Private are deliberately distinct from Open here.
- **Invite feeds friend recommendations.**
  [`src/satellite/services/cohort.services.ts`](../../../../src/satellite/services/cohort.services.ts)
  `FriendRecommendedLeague` surfaces Open **and** Invite leagues to a
  member's friends; only Private is excluded.

Collapsing to the prototype's two tiers would erase the Invite tier
that both of these paths rely on. See **Decisions**.

The enum is
[`src/lib/enums/league.ts`](../../../../src/lib/enums/league.ts)
`LeaguePrivacy` (`PRIVATE` / `INVITE` / `OPEN`).

**Surfaces in scope** (both frontend):

- [`src/lib/components/leagues/CreateLeagueModal.svelte`](../../../../src/lib/components/leagues/CreateLeagueModal.svelte)
  — the create sheet. The privacy picker is the `.league-privacy-row`
  fieldset (lines 233–250): a flex row of three `.league-privacy-btn`
  segmented buttons rendering only `privacyLabel(option)`, no
  description. `PRIVACIES` is ordered `[PRIVATE, INVITE, OPEN]` (line
  48); `privacy` defaults to `LeaguePrivacy.INVITE` (lines 54, 120).
- [`src/lib/components/leagues/LeaguePrivacyModal.svelte`](../../../../src/lib/components/leagues/LeaguePrivacyModal.svelte)
  — the owner edit-privacy sheet. Already renders a `role="radiogroup"`
  list of `.league-privacy-row` buttons with `optionLabel` +
  `optionDesc` (lines 140–156) and the loosen-to-Open confirm step
  (40–46, 54–56, 96–101). Same three options, same order.

**Prototype (UI source of truth only):**
`/tmp/claude-0/-home-user-vici-app/aa6da7b5-7f1c-50be-8af4-82776f9f46b7/scratchpad/proto/VICI-V1.8-Handover/`

- `screens.jsx` `CreateLeagueModal` (5516–5639): the visibility block
  (5592–5605) maps options to `.league-vis-card` buttons, each a
  `.league-vis-radio` dot + a column of `.league-vis-title` /
  `.league-vis-sub`.
- `app.css` (6004–6035): `.league-vis-card` / `.league-vis-card.active`
  / `.league-vis-radio` / `.league-vis-title` / `.league-vis-sub` — the
  card layout, the radio-dot active fill, and the accent active border.
- `CHANGELOG.md` V1.8.46 (176–201): describes the card UI. **Its
  2-tier model collapse does NOT transfer** (see Decisions).

**i18n.** All required keys already exist in
[`src/lib/constants/messages/en.ts`](../../../../src/lib/constants/messages/en.ts)
and the sibling catalogs, under the app's `leagues.*` namespace — no
new keys needed:

- Titles: `leagues.create.privacy_open` / `privacy_invite` /
  `privacy_private` (1239–1241).
- Descriptions: `leagues.privacy.desc_open` / `desc_invite` /
  `desc_private` (1247–1252) — already written for the edit sheet, now
  reused by the create sheet too.
- `leagues.create.label_privacy` (1235) for the fieldset legend.

The create sheet's current title-only render (`privacyLabel`) gains the
description via the existing `desc_*` keys; nothing in the prototype's
scattered `lg.*` namespace transfers.

**Reuse first** (per
[`reusability.md`](../../frontend/reusability.md)): the edit sheet
(`LeaguePrivacyModal.svelte`) already has the title-+-description radio
markup and the `optionLabel` / `optionDesc` helpers this spec wants on
the create sheet — the create sheet adopts the **same** pattern rather
than inventing a parallel one, so the two privacy pickers read
identically. No shared sub-component is introduced (see Pending
decisions); if one is later warranted it lands under
`src/lib/components/leagues/`.

## Scope

- **Create sheet privacy cards.** In `CreateLeagueModal.svelte`,
  replace the `.league-privacy-row` segmented buttons (233–250) with a
  `role="radiogroup"` list of visibility cards mirroring the edit
  sheet: each option a `role="radio"` button carrying its title
  (`privacyLabel`) and inline description (a new local helper reading
  `leagues.privacy.desc_${value}`), plus a radio-dot affordance. Keep
  `PRIVACIES` order (`PRIVATE` / `INVITE` / `OPEN`), the `privacy`
  `$state`, and the click-to-select binding unchanged.
- **Visual alignment of the edit sheet.** Bring
  `LeaguePrivacyModal.svelte`'s existing `.league-privacy-row` list to
  the same card visual (radio dot, accent active border/title) so
  create and edit are one consistent control. Behaviour — the
  loosen-to-Open confirm step, `canSubmit`, re-seed `$effect` — is
  untouched.
- **Accessibility.** Both pickers expose a single `radiogroup` with
  `role="radio"` + `aria-checked` per card (the edit sheet already
  does; the create sheet currently uses `aria-pressed` toggles and
  switches to the radio idiom). Each card is keyboard-focusable and the
  description is part of the accessible label or `aria-describedby`.

The change is presentation only: the persisted `privacy` field, the
three `LeaguePrivacy` values, `createLeague` / `updateLeague`, and
every downstream visibility/recommendation/battle decision are
unchanged.

### Out of scope

- **Collapsing to a 2-tier model.** Explicitly rejected — see
  Decisions. The Invite tier stays.
- **Changing visibility semantics** (`isLeaguePubliclyListed`,
  `isLeagueRecommendableToFriends`, battle `isLeagueOpen`) or the copy
  _meaning_ of any tier. Only the picker's presentation changes.
- **Satellite / collection / `.did` changes.** None — no field, assert,
  or endpoint is touched.
- **The league preview card, emblem/colour pickers, invite-code
  affordance** in the create sheet — untouched.
- **New i18n keys.** The needed titles and descriptions already exist
  under `leagues.*`; this spec reuses them.

## Linked issues

Searched the repo's open issues
(`AntonioVentilii/vici-app`) for league / privacy / visibility / create
terms — **no related open issue**. (Search terms used: `league
privacy visibility`, `league create`, `league`.)

## Analytics

`league_created` already exists in the taxonomy — in the TS union
([`src/lib/types/analytics-event.ts`](../../../../src/lib/types/analytics-event.ts)
line 130), the Zod mirror
([`src/lib/schema/analytics-event.schema.ts`](../../../../src/lib/schema/analytics-event.schema.ts)
line 61), and the generated `satellite_extension.did` — but a code
search shows it is **never fired** from app code (only present in
declarations). This spec is a presentation refactor and does not by
itself require new instrumentation; however, since the create flow is
where this card UI lives and the event is already defined, the low-cost
high-value step is to **start emitting the existing `league_created`**
on a successful create, carrying the chosen tier so product can see the
visibility distribution the new cards drive.

- Fire **`league_created`** in `CreateLeagueModal.handleSubmit` after
  `createLeague` resolves, via `track` in
  [`src/lib/services/analytics.services.ts`](../../../../src/lib/services/analytics.services.ts).
  Props: `leagueId` (the created league's id — bounded id data) and
  `label` = the chosen privacy tier (bounded vocabulary:
  `open` / `invite` / `private`, the `LeaguePrivacy` values).
- **No new event name and no new prop** — `league_created`, `leagueId`,
  and `label` all already exist in both halves of the taxonomy, so no
  union/schema/`.did` change is needed. Behavioural only; no PII, no
  free-form text.
- If product prefers to keep this spec strictly presentation-only and
  defer instrumentation, the alternative is to fire nothing — stated as
  a pending decision below. Either way no new taxonomy entry is added.

## Design artifacts (frontend — optional)

None. The card visual is fully specified by the prototype's
`.league-vis-card` CSS (`app.css` 6004–6035) and the app's existing
`.league-privacy-row` description markup in `LeaguePrivacyModal.svelte`;
the implementer ports against those rather than a fresh mock. The cards
use existing theme tokens (`--color-accent`, `--border-base`,
`--bg-surface`, `--text-muted`), so they theme-swap with the rest of
the app for free.

## Implementation outline

1. **Create sheet markup** (`CreateLeagueModal.svelte`): replace the
   `.league-privacy-row` fieldset body (237–249) with a
   `role="radiogroup"` list of cards. Add a local `privacyDesc(value)`
   helper alongside the existing `privacyLabel` (106–107), reading
   `leagues.privacy.desc_${value}`. Each card: `role="radio"`,
   `aria-checked={privacy === option}`, `onclick={() => (privacy =
option)}`, a radio-dot span, and the title + description spans. Keep
   `PRIVACIES` and the `privacy` state as-is.
2. **Card styles**: port `.league-vis-card` / `.league-vis-radio` /
   `.league-vis-title` / `.league-vis-sub` from the prototype's
   `app.css` (6004–6035) into the component `<style>`, translated to the
   app's tokens (`--color-accent` for active border/dot/title,
   `--border-base`, `--bg-surface`, `--text-muted`). Remove the now-dead
   `.league-privacy-row` / `.league-privacy-btn` rules (473–499).
3. **Edit sheet alignment** (`LeaguePrivacyModal.svelte`): update the
   existing `.league-privacy-row` list (140–156, styled 199–239) to the
   same card visual (radio dot + accent active state) so the two
   pickers match. Keep markup semantics (`radiogroup` / `radio` /
   `aria-checked`) and **all** behaviour — the confirm step, `$effect`
   re-seed, `canSubmit` — unchanged.
4. **Analytics** (pending decision permitting): in
   `CreateLeagueModal.handleSubmit`, after `createLeague` resolves and
   before `onCreated`, call `track({ name: 'league_created', leagueId:
league.id, label: privacy })`. No taxonomy change.
5. **Quality**: `npm run quality` + `npm run check`. Update
   [`PRODUCT.md`](../../PRODUCT.md) only if it describes the privacy
   picker's presentation; the tier _semantics_ it documents are
   unchanged, so likely a no-op — confirm during the build.

## Acceptance criteria

- [ ] The create sheet renders **three** radio visibility cards (Open,
      Invite-only, Private), each showing its title and the existing
      `leagues.privacy.desc_*` description inline, with a radio-dot
      affordance.
- [ ] The create and edit sheets present the same card visual — radio
      dot, accent active border, accent active title — so the two
      privacy pickers read as one control.
- [ ] Selecting a card sets the league's `privacy` exactly as the old
      segmented buttons did; the persisted three-tier value and every
      downstream visibility / recommendation / battle decision are
      unchanged.
- [ ] Each picker is a single `radiogroup` of `role="radio"` cards with
      correct `aria-checked`, keyboard-focusable, with the description
      reachable to assistive tech.
- [ ] No new i18n keys; the cards render from the existing
      `leagues.create.privacy_*` titles and `leagues.privacy.desc_*`
      descriptions across every locale.
- [ ] The edit sheet's loosen-to-Open confirm step and re-seed
      behaviour still work.
- [ ] (If analytics included) `league_created` fires once on a
      successful create with `leagueId` and `label` = the chosen tier,
      validating against the existing Zod mirror; no taxonomy /
      schema / `.did` change.
- [ ] `npm run quality` + `npm run check` pass.

## Open questions

- Does [`PRODUCT.md`](../../PRODUCT.md) describe the privacy picker's
  _presentation_ (vs. only the tier semantics)? If it only documents
  semantics, no `PRODUCT.md` change is needed — confirm during the
  build (workflow step 3 requires the update only when behaviour/copy
  changes).

## Pending decisions

- **Default tier on the create sheet.** The app currently defaults to
  `LeaguePrivacy.INVITE` (`CreateLeagueModal.svelte` 54, 120 — a
  deliberate choice per the field's JSDoc in `league.ts` 146–153). The
  prototype defaults to **Open**. This spec does **not** silently
  change it. Two valid options:
  - **Keep Invite** (status quo): the safest default for a small new
    cohort — not publicly listed, but still recommendable to friends
    and joinable by code. No code change.
  - **Switch to Open**: matches the prototype and maximises
    discoverability + battle eligibility from creation, at the cost of
    making a brand-new league publicly listed by default. One-line
    change to the `privacy` `$state` init and `reset()`.
    Owner to decide before flipping to `In progress`. (Recommendation:
    keep **Invite** — it preserves the deliberate privacy-by-default
    posture and the Open default can be reached in two taps; record the
    outcome under Decisions.)
- **Instrument `league_created` now, or stay presentation-only?** The
  event and props already exist and are unfired, so adding it is
  low-cost and high-value (visibility distribution). Default
  recommendation: **include it**. If the owner wants a strictly
  presentation-only PR, defer and fire nothing. No taxonomy change
  either way.
- **Extract a shared `LeagueVisibilityCards` sub-component, or
  duplicate the card markup in both sheets?** The create and edit
  sheets will render the same card. A shared component removes the
  duplication but adds a prop surface (selected value, onSelect,
  options); duplicating keeps each sheet self-contained. Given only two
  call sites and slightly different surrounding chrome (the create sheet
  has no confirm step), this can ship either way. Recommendation: ship
  with **duplicated markup** for this PR and extract later only if a
  third caller appears (avoids premature abstraction); decide at build
  time.

## Decisions

- **Keep the three-tier visibility model — do NOT adopt the
  prototype's 2-tier collapse.** Handed down at spec creation
  (2026-06-25). The prototype's V1.8.46 simplified Open / Invite /
  Private down to Open / Private on the grounds that Invite and Private
  were "nearly identical". In **this app** they are not: Invite has a
  real, wired purpose distinct from both Open and Private —
  - battles gate to **Open only** (`battle.services.ts` `isLeagueOpen`),
    so Invite ≠ Open; and
  - Invite leagues **are** recommended to a member's friends
    (`cohort.services.ts` `FriendRecommendedLeague`,
    `isLeagueRecommendableToFriends`), so Invite ≠ Private.
    Collapsing would either leak Invite leagues into public battle pools
    (if merged into Open) or kill their friend-recommendation reach (if
    merged into Private). We therefore port the prototype's **card UI
    only** and keep all three tiers and their existing `leagues.*` copy.
