# Design-Handoff Audit — `vici design team/` → app

Working roadmap for aligning the SvelteKit app with the design-team handoff
that landed locally at `vici design team/` (May 2026). The folder itself is
**gitignored** — see [`.gitignore`](../../../.gitignore). This page is the
single source of truth for what's been pulled across and what's still
outstanding. Tick rows off as PRs land.

> **Convention:** every commit in the alignment PR (`feat/design-alignment`)
> must update at least one row here in the same commit. When a row reaches
> "✅ Done" it stays in the table for traceability — it's not deleted.

---

## Handoff overview

The team shipped two top-level deliverables:

| Folder                                 | What it is                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `vici design team/VICI Design System/` | Brand package: tokens (CSS), brand assets (SVG/PNG), HTML previews, a React UI-kit (`ui_kits/app`, `ui_kits/marketing`).    |
| `vici design team/VICI WebApp/`        | A coded React prototype of the consumer surface (`flow.jsx`, `screens.jsx`, `onboarding.jsx`, `landing.jsx`, `app.jsx`, …). |

Both are **reference material**, not source. We port intent into the
SvelteKit codebase under `src/lib/`, following the
[reusability rule](./reusability.md): extend existing components first,
only add new ones when nothing fits.

---

## 1. Tokens — `colors_and_type.css`, `webapp-primitives.css`, `webapp-data.css`

The app already exposes the brand palette through Tailwind v4 `@theme` in
[`src/app.css`](../../../src/app.css). Most named colours, the laurel ramp,
the YES/NO/HOLD signals, the parchment / ink scale, and the easing curve
are present. The handoff additions to consider:

| Token                                                                                              | Where in handoff            | App status              | Action                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--shadow-toast`, `--shadow-card-light`                                                            | `colors_and_type.css §5`    | ❌ Missing              | Add to `@theme` as `--shadow-toast` / `--shadow-card-light`; toast surface currently uses `--shadow-modal` as a stand-in.                                                       |
| `--ticker-h: 32px`                                                                                 | `colors_and_type.css §7`    | ❌ Missing              | Add when the Ticker component lands (§4 below).                                                                                                                                 |
| `--reading-max: 64ch`                                                                              | `colors_and_type.css §7`    | ❌ Missing              | Add when a body-text surface needs it; not blocking today.                                                                                                                      |
| `--s-2..--s-128` spacing scale                                                                     | `colors_and_type.css §3`    | ⚠️ Intentionally absent | **Do not port.** Tailwind v4 ships the same 4-px scale as `p-1`, `gap-3`, etc. Use those. The handoff scale exists because their CSS is hand-rolled; ours is utility-generated. |
| `--t-12..--t-128` type scale                                                                       | `colors_and_type.css §2`    | ⚠️ Intentionally absent | **Do not port** for the same reason — use Tailwind's `text-xs`/`text-sm`/`text-base`/… Only port the named oversize values (`--t-88`, `--t-128`) **if** a hero treatment lands. |
| `--tracking-*`, `--leading-*`                                                                      | `colors_and_type.css §2`    | ⚠️ Intentionally absent | Use Tailwind's `tracking-tight` / `leading-snug` utilities. Keep `letter-spacing: 0.12em` for `.allcaps` (already in `.eyebrow`).                                               |
| `--r-2/4/8/12/pill` radii scale                                                                    | `colors_and_type.css §4`    | ⚠️ Partial              | The app uses Tailwind's `rounded-{sm,md,lg,xl,full}` plus `--radius: 0.5rem`. Only port a missing radius **on demand** when a component needs a non-Tailwind value.             |
| `--z-overlay`, `--z-modal`, `--z-dropdown`, `--z-toast`, `--z-tooltip`                             | `webapp-primitives.css`     | ❓ Implicit             | Audit existing modals/popovers; if z-index is inlined per-component, extract to `@theme` once during a primitive pass.                                                          |
| `.allcaps`, `.tabular`, `.serif-italic`, `.lede`, `.surface-elevated`, `.hairline`, `.display-num` | `colors_and_type.css §9–10` | ⚠️ Partial              | `.eyebrow`, `.serif-italic`, `.surface`, `.num` already exist in `src/app.css`. Add the missing helpers only when first consumer needs them.                                    |

**Recommended commit:** `style(design): adopt new shadow and ticker tokens`
— add the three confirmed-missing tokens (`--shadow-toast`,
`--shadow-card-light`, `--ticker-h`) to `@theme` and route the existing
toast / card surfaces to them.

---

## 2. Brand assets — `vici design team/VICI Design System/assets/`

| File (handoff)                   | App target                                                        | Status                                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `logo/vici-wordmark.svg`         | `static/branding/` (favicon source / OG) + `Logo.svelte` consumer | ⚠️ `src/lib/components/layout/Logo.svelte` exists — verify it matches; if not, replace its inline SVG with the handoff vector.               |
| `logo/vici-monogram.svg`         | `static/branding/` + an `IconViciMonogram.svelte` if reused       | ❌ Not in repo                                                                                                                               |
| `logo/vici-app-icon.svg`         | `static/icon-source.svg` (PWA / favicon)                          | ❌ Not in repo                                                                                                                               |
| `icons/signal-{yes,no,hold}.svg` | `$lib/components/icons/` (`IconSignalYes/No/Hold.svelte`)         | ⚠️ Today `lucide-svelte` icons (or none) are used in the prediction interface — audit and switch if the bespoke vectors render better small. |
| `icons/streak-flame.svg`         | `$lib/components/icons/IconStreakFlame.svelte`                    | ❌ Not in repo. Distinct from `FlameChar.svelte` (which is the animated character). The streak-counter badge uses a separate small icon.     |
| `icons/laurel.svg`               | `$lib/components/icons/IconLaurel.svelte`                         | ❌ Not in repo. Likely used in achievement / rank surfaces.                                                                                  |
| `icons/xp-chevron.svg`           | `$lib/components/icons/IconXpChevron.svelte`                      | ❌ Not in repo.                                                                                                                              |
| `imagery/grain.svg`              | `static/branding/grain.svg` (as a CSS `background-image`)         | ❌ Not in repo. Used as a noise-grain overlay on dark surfaces.                                                                              |
| `imagery/laurel-watermark.svg`   | `static/branding/`                                                | ❌ Not in repo.                                                                                                                              |
| `characters/draft.png`           | _reference only_                                                  | ✅ Characters already ported as Svelte components (see §3).                                                                                  |
| `uploads/*.png`                  | _reference only_                                                  | ✅ Not consumed.                                                                                                                             |

**Recommended commit:** `feat(icons): add brand SVG icons from design handoff`
— drop the bespoke icons into `$lib/components/icons/Icon*.svelte` (a11y:
`aria-hidden="true"` on decorative, `aria-label` on icon-only buttons), drop
PWA / favicon vectors into `static/branding/`, and update
[`reusability.md`](./reusability.md) catalog with the new icon names.

---

## 3. Characters — `Characters.jsx`, `characters-anim.css`, `characters.css`

Already ported. **No work needed.**

| Handoff piece                                              | App equivalent                                                                                            | Status                                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Characters.jsx` — Vici                                    | [`src/lib/components/characters/ViciChar.svelte`](../../../src/lib/components/characters/ViciChar.svelte) | ✅ Done                                                                                            |
| `Characters.jsx` — Oracle                                  | [`OracleChar.svelte`](../../../src/lib/components/characters/OracleChar.svelte)                           | ✅ Done                                                                                            |
| `Characters.jsx` — Trickster                               | [`TricksterChar.svelte`](../../../src/lib/components/characters/TricksterChar.svelte)                     | ✅ Done                                                                                            |
| `Characters.jsx` — Flame (5 stages)                        | [`FlameChar.svelte`](../../../src/lib/components/characters/FlameChar.svelte) + `streak.utils.ts`         | ✅ Done                                                                                            |
| `Characters.jsx` — Archivist                               | _intentionally dropped_                                                                                   | ✅ Per `characters.css` comment: _"--char-archivist removed in v2 — see README §7 cast revision."_ |
| `stageForStreak(days)`                                     | [`streak.utils.ts`](../../../src/lib/utils/streak.utils.ts)                                               | ✅ Done                                                                                            |
| `characters-anim.css` keyframes                            | Registered globally in [`src/app.css`](../../../src/app.css) (`char-bob`, `char-blink`, …)                | ✅ Done                                                                                            |
| Companion message UX (not in handoff — repo-only addition) | `Companion.svelte` + `CompanionOverlay.svelte` + `companion.store`                                        | ✅ Bonus                                                                                           |

---

## 4. Components — `vici design team/VICI Design System/ui_kits/app/`

| Handoff component | App equivalent (search-first)                                                                         | Status            | Notes                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BottomNav.jsx`   | [`src/lib/components/layout/MobileNav.svelte`](../../../src/lib/components/layout/MobileNav.svelte)   | ⚠️ Audit          | App's `MobileNav` already exists with active-tab shadow. Diff against handoff for icons, labels, order; align rather than replace.                   |
| `FlowCard.jsx`    | [`src/lib/components/market/FlowCard.svelte`](../../../src/lib/components/market/FlowCard.svelte)     | ⚠️ Audit          | Side-by-side visual diff. Likely small token-only deltas.                                                                                            |
| `MarketCard.jsx`  | [`src/lib/components/market/MarketCard.svelte`](../../../src/lib/components/market/MarketCard.svelte) | ⚠️ Audit          | Same as above. Also check `StackedMarketCard.svelte`.                                                                                                |
| `Ticker.jsx`      | _no app equivalent_                                                                                   | ❌ New            | Lives at top of the marketing surface (and possibly app shell). Goes in `$lib/components/layout/Ticker.svelte` if app-shell, else marketing folder.  |
| `Primitives.jsx`  | `$lib/components/ui/{Button,Card,Badge,...}.svelte`                                                   | ⚠️ Audit          | The handoff `Primitives.jsx` is a reference; the app already has a fuller UI primitives set in `$lib/components/ui/`. Compare buttons/badges/inputs. |
| `Frame.jsx`       | [`Layout/Header.svelte`](../../../src/lib/components/layout/Header.svelte) + `MobileNav`              | ⚠️ Likely covered | Frame = top header + bottom nav wrapper. No new component, but audit Header layout/tokens.                                                           |
| `Characters.jsx`  | _see §3_                                                                                              | ✅ Done           |                                                                                                                                                      |

---

## 5. Screens — `vici design team/VICI Design System/ui_kits/app/screens/` and `VICI WebApp/screens.jsx`

| Handoff screen      | App equivalent                                                                                                                            | Status   | Notes                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `FlowScreen.jsx`    | [`src/lib/components/market/FlowMode.svelte`](../../../src/lib/components/market/FlowMode.svelte)                                         | ⚠️ Audit | Core swipe UX. Check swipe threshold, category glyphs, animation timings against handoff `flow.jsx` (which is the richer source). |
| `MarketsScreen.jsx` | [`src/lib/components/pages/MarketsPage.svelte`](../../../src/lib/components/pages/MarketsPage.svelte)                                     | ⚠️ Audit | Filters, card grid, empty state.                                                                                                  |
| `Onboarding.jsx`    | [`src/lib/components/onboarding/OnboardingFlow.svelte`](../../../src/lib/components/onboarding/OnboardingFlow.svelte)                     | ⚠️ Audit | Compare step content + character moments (`Vici` happy / encouraging / thinking).                                                 |
| `ProfileScreen.jsx` | [`src/lib/components/pages/ProfilePage.svelte`](../../../src/lib/components/pages/ProfilePage.svelte) + `ProfileDashboard.svelte`         | ⚠️ Audit | Stats / streak / achievements.                                                                                                    |
| `RanksScreen.jsx`   | [`src/lib/components/pages/LeaderboardPage.svelte`](../../../src/lib/components/pages/LeaderboardPage.svelte) + `LeaderboardTable.svelte` | ⚠️ Audit | Rename in the handoff is "Ranks" but feature in app is "Leaderboard" — keep app terminology.                                      |
| `WalletScreen.jsx`  | [`src/lib/components/pages/WalletPage.svelte`](../../../src/lib/components/pages/WalletPage.svelte) + `WalletStats.svelte`                | ⚠️ Audit |                                                                                                                                   |
| `Resolution.jsx`    | [`MarketResolutionInterface.svelte`](../../../src/lib/components/market/MarketResolutionInterface.svelte) + `ResolvedMarketPanel.svelte`  | ⚠️ Audit |                                                                                                                                   |

---

## 6. Landing — `vici design team/VICI Design System/landing/Landing.jsx` (+ `landing.css`)

| Handoff                                              | App equivalent | Status         | Notes                                                                                                                                                                                            |
| ---------------------------------------------------- | -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Landing.jsx` (hero + ticker + sections + FAQ + CTA) | _none_         | ❌ New surface | First public surface for the app. Likely lives as `src/routes/+page.svelte` (split from `(app)/+page.svelte`) or as a new `marketing/` route group. **Discuss before adding a top-level route.** |
| `landing.css` keyframes / sections                   | _none_         | ❌ New         | Either Tailwind-translate or extract module-scoped styles per Landing section.                                                                                                                   |
| `ui_kits/marketing/Sections.jsx`                     | _none_         | ❌ New         | Reusable landing sections; only port if landing actually ships.                                                                                                                                  |

---

## 7. WebApp prototype — `vici design team/VICI WebApp/`

This folder is a self-contained React prototype. Used as a **visual
reference** for the rest of the audit; rarely a 1:1 port target. Notable
files:

| File               | Purpose                                                                                                  | Treatment                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `flow.jsx`         | Definitive Flow Mode reference (45 KB) — per-category animated glyphs, swipe physics, character moments. | Use as the source-of-truth for the FlowMode audit (§5).                         |
| `screens.jsx`      | All screens composed.                                                                                    | Cross-check each screen's layout / spacing.                                     |
| `onboarding.jsx`   | Onboarding sequence.                                                                                     | Cross-check character moments + step content.                                   |
| `landing.jsx`      | Landing page (alt to `VICI Design System/landing/Landing.jsx`).                                          | Use whichever is more complete when landing is built.                           |
| `tweaks-panel.jsx` | Designer-time tweaks panel.                                                                              | _Do not port._ Developer-tool only.                                             |
| `companion.jsx`    | Companion overlay reference.                                                                             | Already implemented in repo (`Companion.svelte`).                               |
| `tokens.css`       | Same as `colors_and_type.css`.                                                                           | Covered in §1.                                                                  |
| `data.js`          | Mock market / character data.                                                                            | _Do not port._ Real data flows through `$lib/stores/markets.store` and friends. |

---

## Commit log (this PR)

Append a row each time a commit on `feat/design-alignment` lands.

| Commit                | Summary                                                                                            | Rows touched          |
| --------------------- | -------------------------------------------------------------------------------------------------- | --------------------- |
| _audit_ (this commit) | Add this audit doc + gitignore the 7.7 MB handoff folder so reference assets don't bleed into git. | All — initial mapping |

---

## Out-of-scope (deliberately)

- **Renaming `Leaderboard` to `Ranks`** in code/UI just because the
  handoff uses "Ranks". Terminology in the app stays.
- **Adopting the handoff's hand-rolled `--s-N` / `--t-N` / `--tracking-*`
  / `--leading-*` scales.** Tailwind v4 utilities already cover the same
  ground (see §1).
- **Wholesale CSS migration to the handoff's stylesheets.** We pull
  tokens and patterns into [`src/app.css`](../../../src/app.css) and
  component `<style>` blocks per the
  [stack-and-patterns rules](./stack-and-patterns.md#tailwind-v4--design-tokens).
- **The React prototype's `tweaks-panel.jsx` and `data.js`.** Developer
  / mock-data tooling, not product.
