# App Design Alignment

Working roadmap for keeping the SvelteKit app aligned with the app
design. This page is the single source of truth for which surfaces /
tokens / assets match the design and which still need work — tick rows
off as PRs land.

> **Convention:** any commit that aligns a surface with the design must
> update at least one row here in the same commit. When a row reaches
> "✅ Done" it stays in the table for traceability — it's not deleted.

The companion guidance lives in:

- [`reusability.md`](./reusability.md) — extend existing components before
  adding new ones.
- [`stack-and-patterns.md`](./stack-and-patterns.md) — Tailwind v4 token
  rules (no `[var(--token)]` arbitrary values; tokens flow through
  `@theme` in [`src/app.css`](../../../src/app.css)).
- [`a11y.md`](./a11y.md) — `aria-hidden` on decorative icons, labelled
  inputs, real buttons.

---

## 1. Tokens

The brand palette is already exposed through Tailwind v4 `@theme` in
[`src/app.css`](../../../src/app.css). Most named colours, the laurel
ramp, the YES/NO/HOLD signals, the parchment / ink scale, and the
easing curve are present. Outstanding items:

| Token                                                                                                                | App status              | Action                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--shadow-toast`, `--shadow-card`, `--shadow-card-light`                                                             | ✅ Done                 | Exposed in `@theme`. `Notifications.svelte` uses `shadow-toast`. `Card.svelte` default variant uses `shadow-card`, which resolves to `--inset-hi` in dark and `--shadow-card-light` in light. |
| `--ticker-h: 32px`                                                                                                   | ✅ Done (token only)    | Declared in `:root` alongside `--header-h` / `--bottomnav-h`. Wire when a Ticker component lands.                                                                                             |
| `--reading-max: 64ch`                                                                                                | ❌ Missing              | Add when a body-text surface needs it; not blocking today.                                                                                                                                    |
| Numeric spacing scale (`--s-N`)                                                                                      | ⚠️ Intentionally absent | **Do not port.** Tailwind v4 ships the same 4-px scale as `p-1`, `gap-3`, etc. The design's hand-rolled scale exists because their CSS is hand-rolled; ours is utility-generated.             |
| Numeric type scale (`--t-N`)                                                                                         | ⚠️ Intentionally absent | **Do not port** for the same reason — use Tailwind's `text-xs` / `text-sm` / `text-base` / … Only port the named oversize values (`--t-88`, `--t-128`) **if** a hero treatment lands.         |
| `--tracking-*`, `--leading-*`                                                                                        | ⚠️ Intentionally absent | Use Tailwind's `tracking-tight` / `leading-snug` utilities. Keep `letter-spacing: 0.12em` for `.allcaps` (already in `.eyebrow`).                                                             |
| Numeric radii scale (`--r-N`)                                                                                        | ⚠️ Partial              | The app uses Tailwind's `rounded-{sm,md,lg,xl,full}` plus `--radius: 0.5rem`. Only port a missing radius **on demand** when a component needs a non-Tailwind value.                           |
| Z-index scale (`--z-overlay`, `--z-modal`, `--z-dropdown`, `--z-toast`, `--z-tooltip`)                               | ❓ Implicit             | Audit existing modals / popovers; if z-index is inlined per-component, extract to `@theme` once during a primitive pass.                                                                      |
| Utility classes (`.allcaps`, `.tabular`, `.serif-italic`, `.lede`, `.surface-elevated`, `.hairline`, `.display-num`) | ⚠️ Partial              | `.eyebrow`, `.serif-italic`, `.surface`, `.num` already exist in `src/app.css`. Add the missing helpers only when first consumer needs them.                                                  |

---

## 2. Brand assets

| Asset                                | App target                                                                                                    | Status                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wordmark SVG                         | `static/branding/vici-wordmark.svg` + [`Logo.svelte`](../../../src/lib/components/layout/Logo.svelte)         | ✅ Done. `Logo.svelte` inlines the wordmark paths and themes via `currentColor` (`text-primary`); the hover glow is preserved as a `drop-shadow` on the SVG.                |
| Monogram SVG                         | `static/branding/vici-monogram.svg`                                                                           | ✅ Done. Wrap in `IconViciMonogram.svelte` if a reusable consumer appears.                                                                                                  |
| App icon SVG                         | `static/branding/vici-app-icon.svg` (PWA / favicon)                                                           | ✅ Done. Wired in [`app.html`](../../../src/app.html) as the SVG favicon; PNG kept as a fallback for older browsers.                                                        |
| Signal icons (`yes` / `no` / `hold`) | [`IconSignalYes`](../../../src/lib/components/icons/IconSignalYes.svelte) / `IconSignalNo` / `IconSignalHold` | ✅ Done. Audit + swap into the prediction interface as a separate `style(market)` commit if the bespoke vectors render better small.                                        |
| Streak-flame icon                    | [`IconStreakFlame`](../../../src/lib/components/icons/IconStreakFlame.svelte)                                 | ✅ Done. Distinct from `FlameChar.svelte` (the animated character).                                                                                                         |
| Laurel icon                          | [`IconLaurel`](../../../src/lib/components/icons/IconLaurel.svelte)                                           | ✅ Done. Non-square (200×120); pass `size` as the height.                                                                                                                   |
| XP chevron                           | [`IconXpChevron`](../../../src/lib/components/icons/IconXpChevron.svelte)                                     | ✅ Done.                                                                                                                                                                    |
| Grain texture                        | `static/branding/grain.svg` (use as a CSS `background-image`)                                                 | ✅ Done. Layered into [`Background.svelte`](../../../src/lib/components/layout/Background.svelte) as a 200×200 tiled overlay with `mix-blend-mode: overlay` and 5% opacity. |
| Laurel watermark                     | `static/branding/laurel-watermark.svg`                                                                        | ✅ Done.                                                                                                                                                                    |

When adding bespoke icons, register them in
[`reusability.md`](./reusability.md) so the next agent finds them.

---

## 3. Characters

Already implemented. **No work needed.**

| Character                                                 | App equivalent                                                                                                                                                                          | Status  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Vici (4 moods)                                            | [`src/lib/components/characters/ViciChar.svelte`](../../../src/lib/components/characters/ViciChar.svelte)                                                                               | ✅ Done |
| Oracle                                                    | [`OracleChar.svelte`](../../../src/lib/components/characters/OracleChar.svelte)                                                                                                         | ✅ Done |
| Trickster (± lightning)                                   | [`TricksterChar.svelte`](../../../src/lib/components/characters/TricksterChar.svelte)                                                                                                   | ✅ Done |
| Flame (5 stages: spark → ember → flame → blaze → inferno) | [`FlameChar.svelte`](../../../src/lib/components/characters/FlameChar.svelte) + [`streak.utils.ts`](../../../src/lib/utils/streak.utils.ts)                                             | ✅ Done |
| Companion message UX                                      | [`Companion.svelte`](../../../src/lib/components/ui/Companion.svelte) + `CompanionOverlay.svelte` + `companion.store`                                                                   | ✅ Done |
| Character idle animations                                 | Registered globally in [`src/app.css`](../../../src/app.css) (`char-bob`, `char-blink`, `char-pulse`, `char-twinkle`, `char-ear`, `char-tail`, `char-bolt`, `char-flicker`, `char-pop`) | ✅ Done |

---

## 4. Components

| Component          | App equivalent (search-first)                                                                         | Status               | Notes                                                                                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bottom navigation  | [`src/lib/components/layout/MobileNav.svelte`](../../../src/lib/components/layout/MobileNav.svelte)   | ⚠️ Audit             | Already exists with active-tab shadow. Diff against the design for icons, labels, order; align rather than replace.                                                                                                                                                                                          |
| Flow card          | [`src/lib/components/market/FlowCard.svelte`](../../../src/lib/components/market/FlowCard.svelte)     | ⚠️ Audit             | Side-by-side visual diff against the design's flow-card spec.                                                                                                                                                                                                                                                |
| Market card        | [`src/lib/components/market/MarketCard.svelte`](../../../src/lib/components/market/MarketCard.svelte) | ✅ Hero card aligned | The design's market card is a compact list-row (one bar, vol/traders footer). The app's is a richer hero card with badges + challenge slot — kept as the hero variant. If a tighter row variant becomes needed, add a separate `MarketRow.svelte`. Numbers (time-remaining) now use the `.num` mono utility. |
| Ticker             | _no app equivalent_                                                                                   | ❌ New               | Lives at top of the marketing surface (and possibly app shell). Goes in `$lib/components/layout/Ticker.svelte` if app-shell, else marketing folder.                                                                                                                                                          |
| UI primitives      | `$lib/components/ui/{Button,Card,Badge,Dialog,Modal,Tabs,Tooltip,…}.svelte`                           | ⚠️ Audit             | The repo already has a fuller UI primitives set in `$lib/components/ui/`. Diff button/badge/input variants and inputs against the design.                                                                                                                                                                    |
| Top header / frame | [`Header.svelte`](../../../src/lib/components/layout/Header.svelte) + `MobileNav`                     | ⚠️ Likely covered    | Header layout + bottom nav. No new component, but audit Header tokens (height, padding, dividers).                                                                                                                                                                                                           |
| Characters         | _see §3_                                                                                              | ✅ Done              |                                                                                                                                                                                                                                                                                                              |

---

## 5. Screens

| Screen            | App equivalent                                                                                                                           | Status     | Notes                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flow Mode         | [`src/lib/components/market/FlowMode.svelte`](../../../src/lib/components/market/FlowMode.svelte)                                        | ⚠️ Partial | Inline `rgba(...)` literals in `<style>` swapped to `var(--ink-line)` / `var(--no-wash)` so the surface flips correctly per theme. Structural differences — the design spec is **swipe-only** while the app exposes YES/NO/SKIP buttons + keyboard shortcuts, and per-category animated glyphs aren't yet ported — need a real UX decision and stay open. |
| Markets list      | [`MarketsPage.svelte`](../../../src/lib/components/pages/MarketsPage.svelte)                                                             | ⚠️ Audit   | Filters, card grid, empty state.                                                                                                                                                                                                                                                                                                                          |
| Onboarding        | [`OnboardingFlow.svelte`](../../../src/lib/components/onboarding/OnboardingFlow.svelte)                                                  | ⚠️ Audit   | Compare step content + character moments (`Vici` happy / encouraging / thinking).                                                                                                                                                                                                                                                                         |
| Profile           | [`ProfilePage.svelte`](../../../src/lib/components/pages/ProfilePage.svelte) + `ProfileDashboard.svelte`                                 | ⚠️ Audit   | Stats / streak / achievements.                                                                                                                                                                                                                                                                                                                            |
| Leaderboard       | [`LeaderboardPage.svelte`](../../../src/lib/components/pages/LeaderboardPage.svelte) + `LeaderboardTable.svelte`                         | ⚠️ Audit   |                                                                                                                                                                                                                                                                                                                                                           |
| Wallet            | [`WalletPage.svelte`](../../../src/lib/components/pages/WalletPage.svelte) + `WalletStats.svelte`                                        | ⚠️ Audit   |                                                                                                                                                                                                                                                                                                                                                           |
| Market resolution | [`MarketResolutionInterface.svelte`](../../../src/lib/components/market/MarketResolutionInterface.svelte) + `ResolvedMarketPanel.svelte` | ⚠️ Audit   |                                                                                                                                                                                                                                                                                                                                                           |

---

## 6. Landing page

The app does not currently expose a public landing surface. Adding one
would introduce a new top-level route — surface the discussion in the
PR before doing so (see [structure rule](./structure.md#top-level-src)).

| Surface                                      | App equivalent | Status         | Notes                                                                                            |
| -------------------------------------------- | -------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| Landing page                                 | _none_         | ❌ New surface | First public surface. Likely `src/routes/+page.svelte` split out, or a `marketing/` route group. |
| Landing sections (hero / ticker / FAQ / CTA) | _none_         | ❌ New         | Reusable sections; only port if the landing surface actually ships.                              |

---

## Out-of-scope (deliberately)

- Renaming features just because the design uses a different word
  (e.g. "Ranks" → keep app terminology "Leaderboard").
- Adopting the design's hand-rolled `--s-N` / `--t-N` / `--tracking-*`
  / `--leading-*` scales — Tailwind v4 utilities already cover them
  (see §1).
- Wholesale CSS migration to a parallel stylesheet. Tokens flow through
  [`src/app.css`](../../../src/app.css) `@theme`; per-component styling
  goes in the component's `<style>` block per the
  [stack-and-patterns rules](./stack-and-patterns.md#tailwind-v4--design-tokens).

---

## Commit log

Append a row each time a commit on this branch lands an alignment step.

| Commit                                            | Summary                                                                                                                                                                                                                                                                                                                                                                                                                              | Rows touched             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| `docs(design): audit …`                           | Initial alignment status doc + gitignore the local design reference folder so it doesn't bleed into the repo.                                                                                                                                                                                                                                                                                                                        | All — initial mapping    |
| `docs(design): reframe alignment doc …`           | Rename and rewrite the doc as an ongoing alignment tracker (drop "handoff" framing and local file references).                                                                                                                                                                                                                                                                                                                       | n/a — rewording          |
| `style(design): adopt shadow and ticker tokens`   | Expose `--shadow-toast`, `--shadow-card`, `--shadow-card-light`, `--ticker-h` in `@theme`; route `Notifications.svelte` to `shadow-toast` and `Card.svelte` default variant to a theme-aware `shadow-card`.                                                                                                                                                                                                                          | §1: shadow + ticker rows |
| `feat(icons): add brand SVG icons`                | 6 new `Icon*.svelte` components (`IconSignalYes/No/Hold`, `IconStreakFlame`, `IconLaurel`, `IconXpChevron`) in `$lib/components/icons/`; 5 static brand SVGs in `static/branding/` (wordmark, monogram, app-icon, grain, laurel-watermark). Registered in reusability catalog. No consumers wired yet — those land in per-screen audit commits.                                                                                      | §2: all rows             |
| `feat(branding): wire SVG favicon`                | Add `<link rel="icon" type="image/svg+xml">` pointing at `vici-app-icon.svg` in `src/app.html`; keep the PNG as a fallback for older browsers.                                                                                                                                                                                                                                                                                       | §2: app-icon row         |
| `feat(branding): polish app.html meta`            | Add `theme-color` (per `prefers-color-scheme`), `color-scheme`, page description, and Open Graph + Twitter card meta tags. Skips `og:image` and `apple-touch-icon` until designer-provided rasters land.                                                                                                                                                                                                                             | §2: no rows (meta-only)  |
| `style(layout): inline wordmark SVG in Logo`      | `Logo.svelte` now renders the `vici-wordmark` paths inline with `currentColor`, themed via `text-primary` and with the original glow effect preserved as an SVG `drop-shadow`.                                                                                                                                                                                                                                                       | §2: wordmark row         |
| `style(layout): grain overlay in Background`      | Layer `grain.svg` into `Background.svelte` as a 200×200 tiled overlay (`mix-blend-mode: overlay`, 5% opacity). Adds subtle tooth without reading as visible noise; symmetric across dark / light themes.                                                                                                                                                                                                                             | §2: grain row            |
| `style(market): align MarketCard with brand`      | Remove the `shadow-inset-hi` override on `MarketCard.svelte` so it uses the theme-aware `shadow-card` from the Card primitive (visible drop shadow in light theme, inset highlight in dark). Add the `.num` mono utility to the time-remaining span per the "numbers always mono" brand rule. Document the structural decision to keep the hero card and add a `MarketRow.svelte` only if a compact list-row variant becomes needed. | §4: market card row      |
| `style(market): align FlowMode tokens with brand` | Swap inline `rgba(242, 236, 220, 0.08)` → `var(--ink-line)` (2×) and `rgba(255, 107, 107, 0.12)` → `var(--no-wash)` in `FlowMode.svelte` `<style>` so colors flip per theme. Flags the structural swipe-only-vs-buttoned UX difference in §5 — needs designer input before changing the interaction model.                                                                                                                           | §5: Flow Mode row        |
