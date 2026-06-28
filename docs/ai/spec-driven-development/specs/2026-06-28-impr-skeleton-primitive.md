# Spec: One shared `Skeleton` primitive for pulsating data placeholders

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

Every "data is loading" pulsating placeholder in the app renders through
a single shared primitive, `Skeleton`, instead of each surface
re-deriving its own pulsing grey block. Today the same idea is
re-implemented at least five times with subtly different rhythms,
colours, and reduced-motion handling — a market card pulses at Tailwind's
2s `animate-pulse`, the market-detail screen at a hand-rolled 1.4s
keyframe, the stats grid at another 1.4s keyframe, the dash holdings
figure at 1.6s, the transactions list at Tailwind again. The result is
visually inconsistent and impossible to retune in one place. This change
introduces `src/lib/components/ui/Skeleton.svelte` as the canonical
pulsing placeholder and migrates the existing skeletons and inline
one-offs onto it. Pure presentation refactor — no user-facing behaviour
or data-model change.

## Context

There is no shared skeleton primitive today. The spinner side is already
consolidated (`LoadingSpinner`, "**the** app spinner" per
`reusability.md`); the pulsating-placeholder side is not. The `loaders/`
folder (`src/lib/components/loaders/`) is **data-fetch orchestration**
(`AtomicLoader` / `CachedLoader` / `IdentityAwareLoader` and the
per-store `Loader*` mounts), not visual skeletons — so the visual
primitive belongs in `src/lib/components/ui/` alongside `Button`, `Card`,
and `LoadingSpinner`.

### Existing skeleton components (each rolls its own pulse)

- `src/lib/components/market/MarketCardSkeleton.svelte` — `Card` with
  `animate-pulse` on the container and inner `bg-muted-foreground/10..20`
  rounded blocks (Tailwind, 2s, **not** reduced-motion gated).
- `src/lib/components/market/MarketDetailSkeleton.svelte` — scoped
  `detail-skeleton-block` + `@keyframes detail-skeleton-pulse` (1.4s
  ease-in-out, opacity 0.55↔0.9, reduced-motion gated),
  `color-mix(in srgb, var(--text-muted) 16%, transparent)` fill.
- `src/lib/components/menagerie/MenagerieBadgeSkeleton.svelte` — a sized
  squircle using `animate-pulse` + `color-mix(... var(--text-base) 8%)`.
- `src/lib/components/market/MarketOddsSkeleton.svelte` — inline odds
  bar; inner block is `bg-muted-foreground/30 animate-pulse`. Wrapper
  carries `role="status"` / `aria-busy` / i18n label (introduced by
  the merged `2026-06-14-fix-market-odds-skeletons` spec, #875).

### Inline one-off skeletons (same idea, hand-rolled)

- `src/lib/components/market/MarketDetailStatsGrid.svelte:146,210` —
  `.market-stats-skeleton` + `@keyframes market-stats-pulse` (1.4s, "mirrors
  the market-detail skeleton's block" per its own comment).
- `src/lib/components/pages/DashTransactionsPage.svelte:278,500` —
  `.txh-skeleton-row` + `animate-pulse`, `color-mix(... var(--text-base) 6%)`.
- `src/lib/components/profile/ProfileDashboard.svelte:742` —
  `.profile-menagerie-*-skeleton animate-pulse` text blocks (the separate
  `profile-hero-invite-pulse` invite-pill breath is an opacity pulse on a
  styled button — out of scope, see below).
- `src/lib/components/pages/AlbumPage.svelte:81,103,105` —
  `.men-*-skeleton animate-pulse` tiles + earned-count pill.

### Canonical tokens already available

Radius tokens (`--r-8` / `--r-12` / `--r-pill`) and the muted text token
(`--text-muted`) are declared in `src/app.css`. The dominant existing
rhythm is **1.4s ease-in-out** opacity, reduced-motion gated (three of
the five). That becomes the canonical pulse.

## Scope

1. **Define the canonical pulse once as a global `.skeleton` class in
   `src/app.css`**, mirroring the existing `char-*` idle-loop pattern
   (global class + keyframe + a single `prefers-reduced-motion` guard, so
   the class never drifts from its keyframe):
   - `.skeleton` — `display: block`, the muted fill
     (`color-mix(in srgb, var(--text-muted) 18%, transparent)`), and the
     `skeleton-pulse` keyframe (1.4s ease-in-out, opacity 0.55↔0.9).
   - `.skeleton.soft` — the lighter fill (10%) for secondary blocks.
   - `@media (prefers-reduced-motion: reduce)` → `animation: none`.
   - The element owns **size + shape** (its own width/height/radius, via
     utilities or its scoped CSS); the class owns **fill + pulse**. This
     composition is what makes it work with Svelte's scoped styles — a
     component whose geometry lives in a scoped class simply *adds*
     `skeleton` to that element (`class="market-stats-skeleton skeleton"`),
     no specificity fight.
2. **Add `src/lib/components/ui/Skeleton.svelte`** — the ergonomic wrapper
   over that class for plain blocks. Renders
   `<span class="skeleton {soft?} {class}" aria-hidden="true">` with no
   scoped style of its own (it reuses the global class, so there is exactly
   one definition). Props: `class` (sizing/shape, default `rounded-md`),
   `tone` (`default | soft`), `style` (inline size/radius for var-driven
   frames). Decorative only — the semantic wrapper (`role="status"` /
   `aria-busy` / labelled "Loading…") stays in the consumer, exactly as
   `MarketOddsSkeleton` does it.

3. **Migrate the existing skeleton components** onto the canonical pulse:
   `MarketCardSkeleton` + `MarketOddsSkeleton`'s inner bar via the
   `Skeleton` component (its `role`/`aria`/label wrapper stays);
   `MarketDetailSkeleton` + `MenagerieBadgeSkeleton` via the global
   `.skeleton` class (their geometry lives in scoped CSS). Delete the
   now-redundant per-component keyframes (`detail-skeleton-pulse`) and
   bespoke fill/animation, keeping each component's **layout** scaffolding
   (the geometry that mirrors the real module so the screen doesn't reflow).

4. **Migrate the inline one-offs** onto the canonical pulse — the global
   `.skeleton` class for elements whose geometry already lives in scoped
   CSS, the `Skeleton` component for plain blocks:
   `MarketDetailStatsGrid` (drop `market-stats-pulse`),
   `DashTransactionsPage` (drop the `txh-skeleton-row` background +
   `animate-pulse`), `ProfileDashboard` menagerie text skeletons,
   `AlbumPage` tiles + earned pill.

5. **Docs (meta-update, mandatory).** Add `Skeleton` to the UI-primitive
   table in `docs/ai/frontend/reusability.md` ("**the** pulsating
   data-placeholder primitive — use instead of hand-rolling
   `animate-pulse` blocks", mirroring the existing `LoadingSpinner`
   entry), and a one-line pointer in
   `docs/ai/frontend/stack-and-patterns.md` next to the loading-state
   guidance.

### Out of scope

- **Non-skeleton pulses.** Decorative/idle mascot pulses
  (`OracleChar`, the `char-*` idle loops), the landing-page `lp-*` pulses
  in `src/landing.css`, and live-activity indicators
  (`OrderBook` heartbeat, `FlowCardSparkline`) are **not** data-loading
  placeholders and are left untouched.
- **Opacity-breath pulses on styled content elements** — the dash
  holdings em-dash pulse (`db-ph-pulse` on `.db-wallet .db-ph`) and the
  profile invite-pill pending pulse (`profile-hero-invite-pulse` on
  `.profile-hero-invite--pending`). These breathe a **bordered/text
  element's opacity**, not a muted fill block; the canonical `.skeleton`
  forces a fill, which would clobber their own styling. They are a
  different visual treatment and stay as-is; revisit only if a shared
  opacity-only "pending" variant is wanted later (see Pending decisions).
- **`FlowDeckSkeleton` / `FlowEntry`** Flow cold-load surfaces — these are
  bespoke animated experiences (riffling cards, Oracle orb), not plain
  pulse blocks. Out of scope.
- No data-model, service, or loading-orchestration (`loaders/`) change.

## Linked issues

Searched the open issues on `AntonioVentilii/vici-app` (#1034, #970,
#810, #759, #543) — none concerns loading skeletons or visual
consistency. No `Closes` / `Part of`.

## Analytics

No new analytics. This is a presentation-consolidation refactor — it adds
no new user action or surface and changes no behaviour, so there is
nothing new to measure. Existing events on these screens are unaffected.
Considered and deliberately declined.

## Implementation outline

1. Add the global `.skeleton` / `.skeleton.soft` class + `skeleton-pulse`
   keyframe + reduced-motion guard to `src/app.css` (next to the `char-*`
   idle loops), and the thin `src/lib/components/ui/Skeleton.svelte`
   wrapper over it, per Scope §1–2.
2. `MarketDetailSkeleton.svelte`: add `skeleton` to each
   `detail-skeleton-block` span; strip the fill + animation + keyframe +
   reduced-motion from the scoped `.detail-skeleton-block` rule (keep its
   `border-radius` and the layout containers).
3. `MarketCardSkeleton.svelte`: drop `animate-pulse` from the `Card`,
   replace inner blocks with `<Skeleton>` (use `tone="soft"` for the
   body lines to keep the two-tier depth).
4. `MenagerieBadgeSkeleton.svelte`: add `skeleton soft` to the frame
   `<div>`; drop its bespoke `background` + `animate-pulse` (keep
   size/radius/border).
5. `MarketOddsSkeleton.svelte`: swap the inner `animate-pulse` bar for
   `<Skeleton class="h-[1em] w-12 rounded-md">`; keep the
   `role`/`aria-busy`/label wrapper and the `empty` dash branch.
6. `MarketDetailStatsGrid.svelte`, `DashTransactionsPage.svelte`,
   `ProfileDashboard.svelte` (menagerie text blocks), `AlbumPage.svelte`:
   add `skeleton` (+`soft` for secondary blocks) to the placeholder
   spans; delete the now-dead keyframes / background rules.
7. Update `reusability.md` + `stack-and-patterns.md` (meta-update).
8. `npm run quality && npm run check`; visually confirm light/dark and
   reduced-motion.

## Acceptance criteria

- [ ] The global `.skeleton` class + `skeleton-pulse` keyframe live in
      `app.css` and respect `prefers-reduced-motion: reduce`;
      `src/lib/components/ui/Skeleton.svelte` wraps it.
- [ ] `MarketCardSkeleton`, `MarketDetailSkeleton`,
      `MenagerieBadgeSkeleton`, `MarketOddsSkeleton`,
      `MarketDetailStatsGrid`, `DashTransactionsPage`, `ProfileDashboard`,
      `AlbumPage` all render their placeholders via the canonical pulse
      (the `Skeleton` component or the global `.skeleton` class).
- [ ] `grep` for `detail-skeleton-pulse\|market-stats-pulse` finds no
      per-component skeleton keyframes left; `skeleton-pulse` in `app.css`
      is the only skeleton keyframe (the two opacity-breath pulses
      `db-ph-pulse` / `profile-hero-invite-pulse` are out of scope).
- [ ] No remaining `animate-pulse` on a data-loading placeholder block
      (decorative/landing/activity pulses excluded per Out of scope).
- [ ] Skeletons stay `aria-hidden` decorative; `MarketOddsSkeleton`'s
      `role="status"` + i18n label are unchanged.
- [ ] No visual reflow regression: each migrated skeleton keeps the
      geometry of the real module it stands in for.
- [ ] `reusability.md` lists `Skeleton`; `stack-and-patterns.md` points
      to it.
- [ ] `npm run quality` and `npm run check` pass.

## Pending decisions

- **`tone` prop vs single flat shade.** Default is the two-tone
  (`default` / `soft`) prop so `MarketCardSkeleton`'s title-over-body
  depth survives consolidation. The alternative — one flat muted shade
  everywhere — is simpler but visibly flattens the card skeleton. Lean:
  keep `tone`. Owner to confirm.
- **Shared opacity-breath variant.** Whether to later fold the two
  opacity-breath pulses (`db-ph-pulse` on the dash holdings em-dash,
  `profile-hero-invite-pulse` on the invite pill) into a shared
  "pending" treatment, or leave element-opacity pulses as their own
  thing. Default: leave out of this spec — they breathe a styled
  element, not a fill block.

## Decisions

- **Canonical pulse is a global `.skeleton` class, not a scoped
  component style.** Several existing skeletons size their blocks via
  scoped CSS classes, and Svelte adds a per-component hash to scoped
  selectors — so a scoped style on a parent can't reach a child
  component's element, and a `Skeleton` component couldn't carry their
  geometry without doubling the markup. Putting the fill + pulse in **one
  global class** (the exact pattern the `char-*` idle loops already use:
  global class + keyframe + a single reduced-motion guard) lets every
  skeleton — Tailwind block, scoped-CSS block, or the component — compose
  the same definition by just adding `skeleton` to its element. The
  `Skeleton.svelte` component is a thin ergonomic wrapper over that class,
  not a second source of truth.
- **Element owns size/shape; class owns fill + pulse.** A consumer's own
  width/height/radius (utilities or scoped CSS) and the canonical
  fill/animation never collide, because they style different properties.
- **Canonical pulse = 1.4s ease-in-out, reduced-motion gated.** It is
  already the most common rhythm (detail + stats + profile) and is gentler
  than Tailwind's default `animate-pulse`; standardising on it means the
  Tailwind-based skeletons gain the reduced-motion guard they lacked.
- **Home is `ui/`, not `loaders/`.** `loaders/` is fetch orchestration;
  the visual placeholder is a UI primitive and sits with `LoadingSpinner`.
