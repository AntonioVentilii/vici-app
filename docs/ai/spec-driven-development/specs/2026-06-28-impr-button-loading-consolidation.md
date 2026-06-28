# Spec: Every action button routes its busy state through `Button`'s `status`

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

Every button that runs an async action shows its busy state through the
one shared API — `Button` / `BaseButton`'s `status` prop — instead of
hand-rolling `disabled={saving}` with no spinner. The single place is
already built and ~36 call-sites use it; this spec is about the
stragglers.

**What the code audit found (it reshaped this spec — see Decisions):**
the loading state is already consolidated for everything that uses the
shared `Button`. The remaining hand-rolled buttons fall into three groups,
and only one is a genuine, clean migration target — and even that group is
gated on a visual decision:

1. **Already consolidated** — the `AdminVxpPage` / `WalletPage` "load
   history" affordance is the shared `InfiniteScroll` component
   (`loading={loadingHistory}`); the only `disabled={loadingHistory}` is
   on a `<select>`, not a button. Nothing to migrate.
2. **Not a CTA** — `DashStackCard`'s `disabled={loading}` is on the whole
   tappable holdings _card_; its busy signal is the em-dash placeholder. A
   button spinner would be wrong. Leave it.
3. **Scoped-CSS stragglers** — `HandleEditor` (save), `AvatarEditor`
   (done), `SharePopover` (share-card CTA) each style their button with
   **scoped CSS** (`.handle-editor-save`, `.avatar-editor-done`,
   `.share-card-cta`). Svelte scopes those classes to the component, so
   they **cannot** be applied to a child `Button` / `BaseButton` element
   (the same constraint the skeleton primitive hit). Consolidating them
   therefore means **restyling** them onto the shared `Button` variants —
   a real modularity win but a visual shift that needs an owner's eye. See
   Pending decisions.

So this is not the mechanical "add `status`" pass the first audit implied.
Pure consistency/a11y refactor either way — no new behaviour.

## Context

The consolidated button API already exists and is the target — nothing
new is built here:

- `src/lib/components/ui/BaseButton.svelte` — owns the busy rendering:
  `status: 'enabled' | 'disabled' | 'loading' | 'pending'`, renders a
  spinning `LoaderCircle` + optional `busyLabel` snippet when busy, sets
  `aria-busy`, and maps `cursor-wait` (loading) / `cursor-progress`
  (pending) / `cursor-not-allowed` (disabled) + `opacity-35` when blocked.
- `src/lib/components/ui/Button.svelte` — app-styled wrapper over
  `BaseButton` (variant/size); the default CTA.
- `src/lib/types/components.ts` — `ButtonStatus` and the documented
  `loading` (pre-interaction) vs `pending` (post-click, in-flight)
  distinction.
- Already correct (reference patterns): `market/TradeModal.svelte`
  (`pending` + `busyLabel`), the `admin/*` resolution buttons,
  `arena/*Sheet.svelte`, `portfolio/OpenOrdersTable.svelte` (per-row
  `pending`).

### Scoped-CSS stragglers (the only genuine migration targets)

Each is a real action button with no spinner today, styled with scoped
CSS — so adopting the shared component is a restyle, not a drop-in:

- `src/lib/components/profile/HandleEditor.svelte:303` — `.handle-editor-save`
  pill (`disabled={!canSave}`, gated on `pending`); paired `.handle-editor-cancel`.
- `src/lib/components/profile/AvatarEditor.svelte:318` — `.avatar-editor-done`
  pill (`disabled={saving}`, already swaps label to "Saving…").
- `src/lib/components/market/SharePopover.svelte:429` — `.share-card-cta`
  (icon + label, `disabled={busy || !cardAvailable}`, swaps to "Preparing…").
  The branded `.share-tile` story buttons (custom per-app icons) are a
  distinct control, **not** CTAs — left alone.

### Audited and left alone (not migration targets)

- `AdminVxpPage` / `WalletPage` "load history" → already the shared
  `InfiniteScroll` component; the `disabled={loadingHistory}` is on a
  `<select>`.
- `DashStackCard` → whole-card tap target, busy shown via the em-dash
  placeholder, not a CTA spinner.
- Form-field gatekeeping inputs (`leagues/School*Step.svelte`,
  `AffiliationPickerModal`, `LeaguePrivacyModal`, `AdminOracleManager`) —
  `disabled={submitting}` on **inputs**, not busy CTAs.

### Custom-spinner button — left as-is (decided)

- `src/lib/components/.../SignInProviderStack.svelte` — per-provider
  buttons use `class:is-loading`, a bespoke `.signin-spinner`, manual
  `aria-busy`, and a mid-state text swap. **Decision: leave it custom.**
  Its branded per-provider shell (icon + colour per provider) is its own
  established pattern and reworking it into the shared `Button` would be a
  styling change, not a busy-state consolidation. Out of scope for this
  PR.

## Scope

This PR lands the **decision groundwork**, not a guessed restyle:

1. **Docs (meta-update).** State the rule plainly in `reusability.md`'s
   `Button` / `BaseButton` entries: any async action button drives its
   busy state through `status` (spinner + `aria-busy`), never a
   hand-rolled `disabled`-only state — so the next author lands new
   buttons on the shared API and no new strays appear. Wording update, no
   new catalog row.
2. **The three scoped-CSS straggler migrations are gated on the restyle
   decision** (Pending decisions). Once the owner picks a path, the
   chosen migration lands — in this PR if resolved during review, else as
   the fast-follow this spec records.

### Out of scope

- **The `Button` / `BaseButton` API itself.** It already does everything
  needed; no prop additions.
- **`SignInProviderStack`** — branded shell, left custom (decided above).
- **Form-field gatekeeping inputs / `DashStackCard` / `InfiniteScroll`
  loaders** — audited and left alone (above).
- **`NestedButton`** — intentionally has no busy state.

## Linked issues

Searched the open issues on `AntonioVentilii/vici-app` (#1034, #970,
#810, #759, #543) — none concerns button loading states. No `Closes` /
`Part of`.

## Analytics

No new analytics. This is an a11y/consistency refactor of existing
buttons — no new action or surface, no behaviour change. Considered and
deliberately declined.

## Implementation outline

1. Update the `reusability.md` Button / BaseButton wording with the
   "async action button → `status`" rule (meta-update).
2. **After** the restyle decision (Pending decisions), for each of
   `HandleEditor`, `AvatarEditor`, `SharePopover`: replace the
   scoped-CSS button with the chosen treatment — either the shared
   `Button` (variant + `status` folding the disabled gate + `busyLabel`
   where copy already swaps) or an inline shared spinner — and delete the
   now-dead scoped button styles.
3. `npm run quality && npm run check`; manually trigger each migrated
   action and confirm the spinner + disabled behaviour.

## Acceptance criteria

- [ ] `reusability.md` states the "async action button → `status`" rule.
- [ ] The restyle decision below is resolved and recorded under Decisions.
- [ ] Per the resolved decision, `HandleEditor` / `AvatarEditor` /
      `SharePopover` show a shared busy treatment (spinner + `aria-busy`)
      while in flight, preserving their prior disabled gates; or are
      explicitly left as-is with the reason recorded.
- [ ] `SignInProviderStack`, `DashStackCard`, the `InfiniteScroll`
      loaders, and form-field inputs are unchanged.
- [ ] `npm run quality` and `npm run check` pass.

## Pending decisions

- **Restyle the scoped-CSS stragglers onto the shared `Button`, or
  leave their look and add only a spinner?** The three buttons
  (`HandleEditor` save, `AvatarEditor` done, `SharePopover` share-card
  CTA) can't carry their scoped classes onto a child `Button` element, so
  the choices are: **(a)** adopt the shared `Button` variants (true
  consolidation onto one API; minor visual shift to the canonical pill —
  needs a design eye), or **(b)** keep each button's exact look and inject
  only the shared `LoaderCircle` spinner while busy (visual-neutral, safe,
  but does not unify them onto the `Button` API). Lean: (a) for the two
  plain pills (`HandleEditor`, `AvatarEditor` are already pills that
  reinvent `Button`), (b) for `SharePopover` (its CTA sits in a bespoke
  share grid). Owner to confirm before the code migration lands.
- **`busyLabel` vs spinner-only.** Where (a) is chosen, match the copy the
  surface already swaps to (`Saving…` / `Preparing…`); spinner-only where
  it shows none.

## Decisions

- **The audit reshaped the scope.** The first pass listed ~6 "hand-rolled
  busy buttons". Reading the code: two are already on shared components
  (`InfiniteScroll`), one is a non-CTA card, and the rest are
  scoped-CSS-styled so they can't drop-in adopt `Button`. The honest
  scope is three scoped-CSS stragglers whose migration is a restyle
  decision, not a mechanical pass — so this PR lands the documented rule +
  the decision, and the code migration follows the owner's call.
- **Adopt the existing API; build nothing.** The single place already
  exists (`Button` `status`); the value is finishing adoption, not
  extending the component. No prop additions.
- **Folded gates over stacked conditionals.** When a straggler is
  migrated, its existing `disabled` validity gate moves **into** the
  `status` expression, so each button has one source of truth for its
  interaction state.
