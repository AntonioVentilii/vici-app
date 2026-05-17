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

| Token                                                                                                                | App status              | Action                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--shadow-toast`, `--shadow-card`, `--shadow-card-light`                                                             | ❌ Missing              | Expose in `@theme`; route the toast surface to `shadow-toast`; make `Card`'s default variant resolve to inset highlight in dark and a soft drop shadow in light.                      |
| `--ticker-h: 32px`                                                                                                   | ❌ Missing              | Add to `:root` (sibling of `--header-h` / `--bottomnav-h`); wire when a Ticker component lands.                                                                                       |
| `--reading-max: 64ch`                                                                                                | ❌ Missing              | Add when a body-text surface needs it; not blocking today.                                                                                                                            |
| Numeric spacing scale (`--s-N`)                                                                                      | ⚠️ Intentionally absent | **Do not port.** Tailwind v4 ships the same 4-px scale as `p-1`, `gap-3`, etc. The design's hand-rolled scale exists because their CSS is hand-rolled; ours is utility-generated.     |
| Numeric type scale (`--t-N`)                                                                                         | ⚠️ Intentionally absent | **Do not port** for the same reason — use Tailwind's `text-xs` / `text-sm` / `text-base` / … Only port the named oversize values (`--t-88`, `--t-128`) **if** a hero treatment lands. |
| `--tracking-*`, `--leading-*`                                                                                        | ⚠️ Intentionally absent | Use Tailwind's `tracking-tight` / `leading-snug` utilities. Keep `letter-spacing: 0.12em` for `.allcaps` (already in `.eyebrow`).                                                     |
| Numeric radii scale (`--r-N`)                                                                                        | ⚠️ Partial              | The app uses Tailwind's `rounded-{sm,md,lg,xl,full}` plus `--radius: 0.5rem`. Only port a missing radius **on demand** when a component needs a non-Tailwind value.                   |
| Z-index scale (`--z-overlay`, `--z-modal`, `--z-dropdown`, `--z-toast`, `--z-tooltip`)                               | ❓ Implicit             | Audit existing modals / popovers; if z-index is inlined per-component, extract to `@theme` once during a primitive pass.                                                              |
| Utility classes (`.allcaps`, `.tabular`, `.serif-italic`, `.lede`, `.surface-elevated`, `.hairline`, `.display-num`) | ⚠️ Partial              | `.eyebrow`, `.serif-italic`, `.surface`, `.num` already exist in `src/app.css`. Add the missing helpers only when first consumer needs them.                                          |

---

## 2. Brand assets

| Asset                                | App target                                                                           | Status                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Wordmark SVG                         | `static/branding/` + [`Logo.svelte`](../../../src/lib/components/layout/Logo.svelte) | ⚠️ `Logo.svelte` exists — diff its inline SVG against the design wordmark and align if it drifts.                                            |
| Monogram SVG                         | `static/branding/` + an `IconViciMonogram.svelte` if reused                          | ❌ Not in repo                                                                                                                               |
| App icon SVG                         | `static/icon-source.svg` (PWA / favicon)                                             | ❌ Not in repo                                                                                                                               |
| Signal icons (`yes` / `no` / `hold`) | `$lib/components/icons/` (`IconSignalYes/No/Hold.svelte`)                            | ⚠️ Today `lucide-svelte` icons (or none) are used in the prediction interface — audit and switch if the bespoke vectors render better small. |
| Streak-flame icon                    | `$lib/components/icons/IconStreakFlame.svelte`                                       | ❌ Not in repo. Distinct from `FlameChar.svelte` (which is the animated character). The streak-counter badge uses a separate small icon.     |
| Laurel icon                          | `$lib/components/icons/IconLaurel.svelte`                                            | ❌ Not in repo. Likely used in achievement / rank surfaces.                                                                                  |
| XP chevron                           | `$lib/components/icons/IconXpChevron.svelte`                                         | ❌ Not in repo.                                                                                                                              |
| Grain texture                        | `static/branding/grain.svg` (as a CSS `background-image`)                            | ❌ Not in repo. Used as a noise-grain overlay on dark surfaces.                                                                              |
| Laurel watermark                     | `static/branding/laurel-watermark.svg`                                               | ❌ Not in repo.                                                                                                                              |

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

| Component          | App equivalent (search-first)                                                                         | Status            | Notes                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bottom navigation  | [`src/lib/components/layout/MobileNav.svelte`](../../../src/lib/components/layout/MobileNav.svelte)   | ⚠️ Audit          | Already exists with active-tab shadow. Diff against the design for icons, labels, order; align rather than replace.                                 |
| Flow card          | [`src/lib/components/market/FlowCard.svelte`](../../../src/lib/components/market/FlowCard.svelte)     | ⚠️ Audit          | Side-by-side visual diff against the design's flow-card spec.                                                                                       |
| Market card        | [`src/lib/components/market/MarketCard.svelte`](../../../src/lib/components/market/MarketCard.svelte) | ⚠️ Audit          | Same as above. Also check `StackedMarketCard.svelte`.                                                                                               |
| Ticker             | _no app equivalent_                                                                                   | ❌ New            | Lives at top of the marketing surface (and possibly app shell). Goes in `$lib/components/layout/Ticker.svelte` if app-shell, else marketing folder. |
| UI primitives      | `$lib/components/ui/{Button,Card,Badge,Dialog,Modal,Tabs,Tooltip,…}.svelte`                           | ⚠️ Audit          | The repo already has a fuller UI primitives set in `$lib/components/ui/`. Diff button/badge/input variants and inputs against the design.           |
| Top header / frame | [`Header.svelte`](../../../src/lib/components/layout/Header.svelte) + `MobileNav`                     | ⚠️ Likely covered | Header layout + bottom nav. No new component, but audit Header tokens (height, padding, dividers).                                                  |
| Characters         | _see §3_                                                                                              | ✅ Done           |                                                                                                                                                     |

---

## 5. Screens

| Screen            | App equivalent                                                                                                                           | Status   | Notes                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| Flow Mode         | [`src/lib/components/market/FlowMode.svelte`](../../../src/lib/components/market/FlowMode.svelte)                                        | ⚠️ Audit | Core swipe UX. Check swipe threshold, category glyphs, animation timings against the design's Flow Mode spec. |
| Markets list      | [`MarketsPage.svelte`](../../../src/lib/components/pages/MarketsPage.svelte)                                                             | ⚠️ Audit | Filters, card grid, empty state.                                                                              |
| Onboarding        | [`OnboardingFlow.svelte`](../../../src/lib/components/onboarding/OnboardingFlow.svelte)                                                  | ⚠️ Audit | Compare step content + character moments (`Vici` happy / encouraging / thinking).                             |
| Profile           | [`ProfilePage.svelte`](../../../src/lib/components/pages/ProfilePage.svelte) + `ProfileDashboard.svelte`                                 | ⚠️ Audit | Stats / streak / achievements.                                                                                |
| Leaderboard       | [`LeaderboardPage.svelte`](../../../src/lib/components/pages/LeaderboardPage.svelte) + `LeaderboardTable.svelte`                         | ⚠️ Audit |                                                                                                               |
| Wallet            | [`WalletPage.svelte`](../../../src/lib/components/pages/WalletPage.svelte) + `WalletStats.svelte`                                        | ⚠️ Audit |                                                                                                               |
| Market resolution | [`MarketResolutionInterface.svelte`](../../../src/lib/components/market/MarketResolutionInterface.svelte) + `ResolvedMarketPanel.svelte` | ⚠️ Audit |                                                                                                               |

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

| Commit                  | Summary                                                                                                       | Rows touched          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------- |
| `docs(design): audit …` | Initial alignment status doc + gitignore the local design reference folder so it doesn't bleed into the repo. | All — initial mapping |
