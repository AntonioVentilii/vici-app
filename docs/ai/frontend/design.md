# App Design

Working roadmap and rule book for the SvelteKit app's design. This
page is the single source of truth for which surfaces / tokens /
assets exist, which still need work, and the behavioural rules that
govern Flow Mode (§7). Tick rows off as PRs land.

> **Conventions** — any agent or contributor working on the design
> must respect both:
>
> 1. Any commit that adjusts a design surface must update at least
>    one row here in the same commit. When a row reaches "✅ Done"
>    it stays in the table for traceability — it's not deleted.
> 2. **Never reference temporary or external design source materials**
>    — folder names, spec exports, file names, or section numbers
>    from those files — anywhere in the repo (code, comments, commit
>    messages, PR bodies). Temporary scratch is temporary; the
>    product reflects **the** design. When a code comment needs to
>    cite a rule, point at this file (`docs/ai/frontend/design.md`)
>    and the relevant section. Don't qualify the design as "new",
>    "old", "redesigned", or "previous" — there is only one.

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

| Screen            | App equivalent                                                                                                                                                              | Status   | Notes                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flow Mode         | [`src/lib/components/market/FlowMode.svelte`](../../../src/lib/components/market/FlowMode.svelte) + [`FlowCard.svelte`](../../../src/lib/components/market/FlowCard.svelte) | ✅ Done  | Swipe deck with brand-aligned typography, generative artwork in-card, footer hint rail, 80 ms commit-feedback beat, named haptic patterns, daily-streak Flame chip, reward ladder, character bubbles (priority-resolved), and a brand-voice FlowEnd. Buttons + keyboard shortcuts kept as accessibility fallback. See §7 below for the rules. |
| Markets list      | [`MarketsPage.svelte`](../../../src/lib/components/pages/MarketsPage.svelte)                                                                                                | ⚠️ Audit | Filters, card grid, empty state.                                                                                                                                                                                                                                                                                                              |
| Onboarding        | [`OnboardingFlow.svelte`](../../../src/lib/components/onboarding/OnboardingFlow.svelte)                                                                                     | ⚠️ Audit | Compare step content + character moments (`Vici` happy / encouraging / thinking).                                                                                                                                                                                                                                                             |
| Profile           | [`ProfilePage.svelte`](../../../src/lib/components/pages/ProfilePage.svelte) + `ProfileDashboard.svelte`                                                                    | ⚠️ Audit | Stats / streak / achievements.                                                                                                                                                                                                                                                                                                                |
| Leaderboard       | [`LeaderboardPage.svelte`](../../../src/lib/components/pages/LeaderboardPage.svelte) + `LeaderboardTable.svelte`                                                            | ⚠️ Audit |                                                                                                                                                                                                                                                                                                                                               |
| Wallet            | [`WalletPage.svelte`](../../../src/lib/components/pages/WalletPage.svelte) + `WalletStats.svelte`                                                                           | ⚠️ Audit |                                                                                                                                                                                                                                                                                                                                               |
| Market resolution | [`MarketResolutionInterface.svelte`](../../../src/lib/components/market/MarketResolutionInterface.svelte) + `ResolvedMarketPanel.svelte`                                    | ⚠️ Audit |                                                                                                                                                                                                                                                                                                                                               |

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

## 7. Flow Mode — rules

The swipe deck is the primary surface and carries the brand's heaviest
behavioral contract. The rules below are the source of truth — code
comments reference these rules, not vice versa.

### 7.1 Motion principles

- **Affirm, don't narrate.** A motion has to earn its place by adding
  something a number can't ("Locked in." not "Great job!").
- **Scarcity protects meaning.** Routine swipes are silent on the
  character layer — XP pop + edge tint + haptic only. Characters
  appear at milestones, state changes, and resolution events.
- **Speed is a feeling.** Reactive motion fires within 80–150 ms of an
  action. Past 200 ms the swipe rhythm breaks and the user notices the
  lag instead of the result. The commit-feedback beat in
  `FlowMode.svelte` is fixed at `COMMIT_FEEDBACK_MS = 80`.
- **Defended territory.** Each character owns one moment:
  VICI = protagonist + ambient · Flame = streak only ·
  Oracle = truth (resolution / threshold) · Trickster = contrarian
  predictions (low-consensus cards). They never cross territory.
- **Negative states deserve motion.** A wrong call, a broken streak,
  a skip, an empty deck — each has its own choreography. None borrow
  celebratory vocabulary; none go silent.
- **The ladder stretches.** First predictions feel like fireworks;
  later rewards are rare and feel earned. Bonus XP scales with
  rarity, not consistency (see §7.3).

### 7.2 Swipe commit choreography

| Phase                  | Duration                     | What happens                                                                   |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| Release past threshold | —                            | Card locks, edge tint at full opacity, directional label visible, haptic fires |
| Commit feedback beat   | 80 ms (`COMMIT_FEEDBACK_MS`) | Card frozen in committed state — drag disabled                                 |
| Exit                   | ~450 ms `out:fly`            | `flying-yes` / `flying-no` / `flying-up` translates the card off-screen        |
| Reset                  | 600 ms (`COMMIT_RESET_MS`)   | Parent clears `committedAction` so the next card mounts neutral                |

Double-commits during the 80 ms window are ignored.

### 7.3 Reward ladder (swipe-count)

Defined in
[`src/lib/constants/flow-rewards.constants.ts`](../../../src/lib/constants/flow-rewards.constants.ts).
Base XP is `BASE_XP_PER_PREDICTION = 10` per committed swipe (YES / NO),
multiplied by the session-combo multiplier. Bonus XP stacks on top at
the exact swipe count below — exponential spacing:

| Swipe # | Bonus XP | Paired copy     | Haptic         |
| ------- | -------- | --------------- | -------------- |
| 1       | +50      | "First call."   | `triple-tap`   |
| 10      | +100     | "Ten deep."     | `double-pulse` |
| 50      | +250     | "Fifty in."     | `double-pulse` |
| 250     | +500     | "Two-fifty."    | `double-pulse` |
| 1000    | +1000    | "One thousand." | `double-pulse` |

First-call gets the strongest haptic; other milestones use a double
pulse so they don't out-shout streak tier-ups.

### 7.4 Daily streak — Flame stages

Defined in [`src/lib/utils/streak.utils.ts`](../../../src/lib/utils/streak.utils.ts)
(`stageForStreak`, `applyDailyStreakBump`, `todayKey`, `dayDelta`).
Five stages on a day count:

| Stage   | Days  | Notes                                                                         |
| ------- | ----- | ----------------------------------------------------------------------------- |
| SPARK   | 1–2   | Streak just starting (also: the visual after a break — Flame never goes dark) |
| EMBER   | 3–6   |                                                                               |
| FLAME   | 7–14  | Top-bar Flame chip activates `is-hot` from here                               |
| BLAZE   | 15–29 |                                                                               |
| INFERNO | 30+   |                                                                               |

Rules:

- Streak progresses on **any swipe** (YES, NO, SKIP all count) once per
  local day.
- **No freezes, no rescues, no second chances.** A missed day resets
  to SPARK 1 on the next swipe.
- Break choreography: `low-thud` haptic + single banner naming the
  stage that ended ("BLAZE ended. Fresh start."). No celebration, no
  consolation.
- Flame appears in the Flow header + home screen only — never on
  every screen.

### 7.5 Accuracy gate

Below `ACCURACY_GATE_CALLS = 30` lifetime calls, accuracy is hidden —
calls + streak are the visible stats. The percentage unlocks at 30,
which is the smallest sample where it starts to be meaningful (and
not noisy). Applies to the FlowEnd summary; should be applied to
Profile + leaderboard previews on their next pass.

### 7.6 Negative-state choreography

| State                                    | Haptic           | Visual                                                   |
| ---------------------------------------- | ---------------- | -------------------------------------------------------- |
| Wrong call (resolution event, Portfolio) | `low-thud` (TBD) | Dim — no character                                       |
| Streak break                             | `low-thud`       | "X ended. Fresh start." banner, fresh SPARK              |
| Skip                                     | `soft-tick`      | Card flies up; session combo unchanged (skip is neutral) |
| Empty deck                               | none             | VICI in `thinking` mood + "Nothing here. Yet."           |

### 7.7 Character beats — priority resolver

`pickHighestPriorityBeat` in
[`src/lib/utils/flow-companion.utils.ts`](../../../src/lib/utils/flow-companion.utils.ts).
Multiple beats can be eligible on a single swipe; only the highest
priority fires:

```
Resolution > Threshold > Streak tier-up > First-time >
Swipe-count > Low-consensus > Ambient
```

Lower-priority beats are dropped, not queued — by the next swipe
they're stale.

### 7.8 Generative artwork — per-category

Defined in [`src/lib/utils/flow-art.utils.ts`](../../../src/lib/utils/flow-art.utils.ts)

- [`src/lib/components/artwork/FlowArtFrame.svelte`](../../../src/lib/components/artwork/FlowArtFrame.svelte).
  Six categories, six visual languages — same formal vocabulary per
  category, different specifics per market:

| Category   | Visual language                                                                        |
| ---------- | -------------------------------------------------------------------------------------- |
| `macro`    | Concentric rings + horizontal atmospheric planes; one bright core anchors the eye      |
| `crypto`   | Angular polygon shards + neon seam piercing the focal shard; small floating fragment   |
| `sports`   | Heavy chevron stroke + trailing chevrons + diagonal speed strokes                      |
| `politics` | Colonnade — 5–9 columns, lintel, base; focal column wider + accent-gilded              |
| `tech`     | Isometric block stack on a faint dot grid; one focal block accent-blue                 |
| `culture`  | 1–2 organic ink blobs on warm paper wash; single calligraphic stroke + scattered marks |

Three states per category — neutral (Flow Mode default), won
(saturate + gild), lost (fracture + desaturate). Resolution-state
crossfade is for Portfolio only; Flow Mode renders neutral only.

Compositional rules every piece must satisfy:

- One clear focal element (rule-of-thirds intersection).
- Readable at 80 × 80 (deck thumb). If it becomes mud at thumb size,
  redesign.
- One strong idea per piece — restraint over density.
- Designed mark, not banner — square viewBox, intentional inner
  padding, never edge-bleeding.
- No suggestion of data — no axis lines, gridlines, percentage
  labels, multi-line waveforms. The card already has the numbers.

Deterministic seeding: same `${category}::${marketId}::${state}`
triplet always renders the identical composition (FNV-1a hash +
mulberry32 PRNG).

### 7.9 Haptic vocabulary

[`src/lib/utils/haptics.utils.ts`](../../../src/lib/utils/haptics.utils.ts) —
nine named patterns. Call sites use the name, never raw ms numbers.

| Pattern        | When                                         |
| -------------- | -------------------------------------------- |
| `light-tap`    | Ambient / background                         |
| `soft-tick`    | Skip — softer than commit, reads "passed"    |
| `firm-tap`     | YES / NO commit on a routine swipe           |
| `double-pulse` | Swipe-count milestone (10 / 50 / 250 / 1000) |
| `triple-tap`   | First call + streak tier-up                  |
| `mischief`     | Trickster signature (staccato)               |
| `soft-hum`     | Idle / Companion arrival                     |
| `low-thud`     | Streak break (honest, no warmth)             |
| `celebration`  | Session complete                             |

The wrapper is best-effort — no-ops on iOS Safari and any UA without
`navigator.vibrate`, never throws.

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

| Commit                                                               | Summary                                                                                                                                                                                                                                                                                                                                                                                                                              | Rows touched                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `docs(design): audit …`                                              | Initial alignment status doc + gitignore the local design reference folder so it doesn't bleed into the repo.                                                                                                                                                                                                                                                                                                                        | All — initial mapping                   |
| `docs(design): reframe alignment doc …`                              | Rename and rewrite the doc as an ongoing alignment tracker (drop "handoff" framing and local file references).                                                                                                                                                                                                                                                                                                                       | n/a — rewording                         |
| `style(design): adopt shadow and ticker tokens`                      | Expose `--shadow-toast`, `--shadow-card`, `--shadow-card-light`, `--ticker-h` in `@theme`; route `Notifications.svelte` to `shadow-toast` and `Card.svelte` default variant to a theme-aware `shadow-card`.                                                                                                                                                                                                                          | §1: shadow + ticker rows                |
| `feat(icons): add brand SVG icons`                                   | 6 new `Icon*.svelte` components (`IconSignalYes/No/Hold`, `IconStreakFlame`, `IconLaurel`, `IconXpChevron`) in `$lib/components/icons/`; 5 static brand SVGs in `static/branding/` (wordmark, monogram, app-icon, grain, laurel-watermark). Registered in reusability catalog. No consumers wired yet — those land in per-screen audit commits.                                                                                      | §2: all rows                            |
| `feat(branding): wire SVG favicon`                                   | Add `<link rel="icon" type="image/svg+xml">` pointing at `vici-app-icon.svg` in `src/app.html`; keep the PNG as a fallback for older browsers.                                                                                                                                                                                                                                                                                       | §2: app-icon row                        |
| `feat(branding): polish app.html meta`                               | Add `theme-color` (per `prefers-color-scheme`), `color-scheme`, page description, and Open Graph + Twitter card meta tags. Skips `og:image` and `apple-touch-icon` until designer-provided rasters land.                                                                                                                                                                                                                             | §2: no rows (meta-only)                 |
| `style(layout): inline wordmark SVG in Logo`                         | `Logo.svelte` now renders the `vici-wordmark` paths inline with `currentColor`, themed via `text-primary` and with the original glow effect preserved as an SVG `drop-shadow`.                                                                                                                                                                                                                                                       | §2: wordmark row                        |
| `style(layout): grain overlay in Background`                         | Layer `grain.svg` into `Background.svelte` as a 200×200 tiled overlay (`mix-blend-mode: overlay`, 5% opacity). Adds subtle tooth without reading as visible noise; symmetric across dark / light themes.                                                                                                                                                                                                                             | §2: grain row                           |
| `style(market): align MarketCard with brand`                         | Remove the `shadow-inset-hi` override on `MarketCard.svelte` so it uses the theme-aware `shadow-card` from the Card primitive (visible drop shadow in light theme, inset highlight in dark). Add the `.num` mono utility to the time-remaining span per the "numbers always mono" brand rule. Document the structural decision to keep the hero card and add a `MarketRow.svelte` only if a compact list-row variant becomes needed. | §4: market card row                     |
| `style(market): align FlowMode tokens with brand`                    | Swap inline `rgba(242, 236, 220, 0.08)` → `var(--ink-line)` (2×) and `rgba(255, 107, 107, 0.12)` → `var(--no-wash)` in `FlowMode.svelte` `<style>` so colors flip per theme. Flags the structural swipe-only-vs-buttoned UX difference in §5 — needs designer input before changing the interaction model.                                                                                                                           | §5: Flow Mode row                       |
| `feat(branding): rasterize favicon variants + OG image`              | Render `vici-app-icon.svg` to size-targeted PNGs (`favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png` at 180×180) and compose a 1200×630 `og-image.png` from the wordmark on the ink canvas with the tagline. Wire all of them in `src/app.html` plus `og:image` + `twitter:card=summary_large_image`. Generated one-shot via headless chromium (already in `@playwright/test`); no new deps, no leftover scripts.            | §2: app-icon + OG slot                  |
| `feat(tokens): align src/app.css with VICI design system`            | Add the missing scale + utility tokens (`--t-12` … `--t-128`, `--leading-*`, `--tracking-*`, `--r-{2,4,8,12,pill}`) and helper classes (`.display`, `.display-num`, `.lede`, `.allcaps`, `.surface-elevated`, `.hairline`) so hand-tuned editorial moments can write `var(--t-88)` / `.display` directly. Pure additive; no visual change.                                                                                           | §1: type / radii / utility-classes rows |
| `feat(artwork): add FlowArt deterministic SVG renderer`              | New `src/lib/utils/flow-art.utils.ts` — six per-category visual languages × three states with FNV-1a + mulberry32 seeded by `${category}::${marketId}::${state}`. Public API: `renderFlowArt`, `flowArtPalette`, `FLOW_ART_CATEGORIES`, `FLOW_ART_STATES`.                                                                                                                                                                           | §7.8 generative artwork                 |
| `feat(artwork): add FlowArtFrame component (80/140/220, neutral)`    | Svelte 5 wrapper at `src/lib/components/artwork/FlowArtFrame.svelte` — square, inset highlight, sized 80/140/220. New `components/artwork/` feature folder (parallel to `characters/`); added to `structure.md`.                                                                                                                                                                                                                     | §4 components (new row)                 |
| `feat(flow): redesign FlowCard — typography + layout + FlowArt`      | New compact meta row (`CATEGORY · 47d · HOLDING X`), brand display typography, FlowArtFrame body slot, simplified probability summary, footer hint rail `← NO · DRAG TO COMMIT · TAP FOR DETAIL · YES →`. Edge-tint + directional label replaces the old 3D stamps. New optional props: `category`, `subtitle`, `flag`. Behavioural API (`onAction`) unchanged.                                                                      | §4 Flow card row                        |
| `feat(flow): swipe commit spec — 80 ms feedback beat`                | `committedAction` prop on FlowCard locks drag and pegs edge tint to 1.0; FlowMode holds the action for `COMMIT_FEEDBACK_MS = 80` then advances. `COMMIT_RESET_MS = 600`.                                                                                                                                                                                                                                                             | §7.2 commit choreography                |
| `feat(flow): rarity-scaled bonus ladder + first-call beat`           | `src/lib/constants/flow-rewards.constants.ts` — `BASE_XP_PER_PREDICTION`, `FLOW_MILESTONES`, `findFlowMilestone`. XP pops gain a `kind: 'normal' \| 'bonus'` variant with paired serif-italic copy + laurel ring on bonus pops.                                                                                                                                                                                                      | §7.3 reward ladder                      |
| `feat(flow): daily-streak engine + Flame stage in top bar`           | Extends `streak.utils.ts` with `todayKey`, `dayDelta`, `applyDailyStreakBump`. Top-bar generic streak count replaced by FlameChar + stage label + day count; break choreography fires the low-thud banner once.                                                                                                                                                                                                                      | §7.4 daily streak                       |
| `feat(flow): accuracy gating below 30 lifetime calls`                | `ACCURACY_GATE_CALLS = 30` + `isAccuracyUnlocked` helper. Gates the FlowEnd third-cell display (calls below the gate, accuracy above).                                                                                                                                                                                                                                                                                               | §7.5 accuracy gate                      |
| `feat(flow): negative-state choreography (skip + empty deck)`        | SKIP no longer resets the session combo; soft-tick haptic. Empty deck switches from the confetti celebration to a `VICI thinking` ambient + "Nothing here. Yet." copy.                                                                                                                                                                                                                                                               | §7.6 negative states                    |
| `feat(haptics): named patterns + Vibration API wrapper`              | `src/lib/utils/haptics.utils.ts` — 9 named patterns, best-effort `navigator.vibrate` wrapper. All FlowMode call sites switched to named patterns.                                                                                                                                                                                                                                                                                    | §7.9 haptic vocabulary                  |
| `feat(characters): Companion beats + priority resolver`              | `flow-companion.utils.ts` — `CompanionBeat` + `pickHighestPriorityBeat`. FlowMode collects candidate beats and fires only the highest. Trickster auto-fires once per market when YES ≤ 25 % or ≥ 75 %, tracked via a `SvelteSet`.                                                                                                                                                                                                    | §7.7 priority resolver                  |
| `feat(flow): redesign FlowEnd summary in brand voice`                | Replaces the confetti / mint-check celebration with a `.display` "Vici." headline, terse copy ("12 calls. Locked in."), and a 3-cell brand grid (Session XP / Daily Streak Flame / Accuracy-or-Calls). Removes `bestStreak` session state (no longer surfaced; daily streak from the Flame engine is the single source of truth).                                                                                                    | §5 Flow Mode → Done                     |
| `docs: fix stale nav.store reference + design-team source location`  | Fixes the false claim of a single-route + nav-store architecture across CLAUDE.md, AGENTS.md, and 4 docs in `docs/ai/frontend/` — routing is file-based under `src/routes/(app)/`. Adds the `artwork/` folder to `structure.md`.                                                                                                                                                                                                     | n/a — docs                              |
| `chore: respect prediction terminology + document lint suppressions` | Renames `BASE_XP_PER_BET` → `BASE_XP_PER_PREDICTION`; reworks a code comment that used "bet" terminology; adds explicit `eslint-disable` rationale on five positional math-callback signatures in `flow-art.utils.ts`.                                                                                                                                                                                                               | n/a — hygiene                           |
| `chore: fold Flow Mode design rules into design.md`                  | Strips temp-folder + spec-attribution references from code comments; folds the Flow Mode reward ladder, motion principles, character territory, haptic vocabulary, artwork rules, and accuracy gate into this doc (§7). Removes the AGENTS.md "design-team source materials" section — temp scratch isn't permanent infrastructure.                                                                                                  | §7 (new) + commit log                   |
