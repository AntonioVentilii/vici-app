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

| Token                                                                                  | App status  | Action                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--shadow-toast`, `--shadow-card`, `--shadow-card-light`                               | ✅ Done     | Exposed in `@theme`. `Notifications.svelte` uses `shadow-toast`. `Card.svelte` default variant uses `shadow-card`, which resolves to `--inset-hi` in dark and `--shadow-card-light` in light. |
| `--ticker-h: 32px`                                                                     | ✅ Done     | Declared in `:root`; consumed by [`Ticker.svelte`](../../../src/lib/components/layout/Ticker.svelte) on `/welcome`.                                                                           |
| Peach theme tokens                                                                     | ✅ Done     | `[data-theme='peach']` defines the warm blush canvas, warm dark foreground, and deeper laurel accent swap.                                                                                    |
| Named oversize type (`--t-88`, `--t-128`)                                              | ✅ Done     | Available for hand-tuned editorial moments via `var(--t-88)` etc.                                                                                                                             |
| Z-index scale (`--z-overlay`, `--z-modal`, `--z-dropdown`, `--z-toast`, `--z-tooltip`) | ❓ Implicit | Audit existing modals / popovers; if z-index is inlined per-component, extract to `@theme` once during a primitive pass.                                                                      |

For spacing, sizing, radii, and most typography use Tailwind v4 utilities
(`p-*`, `gap-*`, `text-*`, `tracking-*`, `leading-*`, `rounded-*`).
Utility classes already exposed in `src/app.css`: `.eyebrow`, `.allcaps`,
`.serif-italic`, `.display`, `.display-num`, `.lede`, `.surface`,
`.surface-elevated`, `.hairline`, `.num`. Add tokens or helpers to
`src/app.css` only when a real consumer needs one.

---

## 1.1 Themes

The app supports three themes through `data-theme` on `<html>`:

| Theme   | Canvas / register                     | Accent rule                                                                |
| ------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `dark`  | Warm near-black, terminal / editorial | `--laurel`                                                                 |
| `light` | Parchment / ink                       | `--laurel`                                                                 |
| `peach` | Warm blush / coral-cream              | `--laurel-deep` (`#B68B1F`) for primary/accent so contrast holds on peach. |

Theme state lives in
[`src/lib/stores/theme.store.ts`](../../../src/lib/stores/theme.store.ts)
and persists to `localStorage` as `vici-theme`.

The canonical picker is
[`src/lib/components/ui/AppearancePicker.svelte`](../../../src/lib/components/ui/AppearancePicker.svelte).
It renders three swatch tiles as pressed buttons (`aria-pressed`) and
is currently mounted in the user menu and the dev-only Tweaks panel.
When the Settings surface lands, use the same component — do not create
a second picker.

Third-party marks keep their own colours in every theme (see §2).

---

## 2. Brand assets

| Asset                                | App target                                                                                                    | Status                                                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wordmark SVG                         | `static/branding/vici-wordmark.svg` + [`Logo.svelte`](../../../src/lib/components/layout/Logo.svelte)         | ✅ Done. `Logo.svelte` inlines the wordmark paths and themes via `currentColor` (`text-primary`); the hover glow is preserved as a `drop-shadow` on the SVG.                 |
| Monogram SVG                         | `static/branding/vici-monogram.svg`                                                                           | ✅ Done. Wrap in `IconViciMonogram.svelte` if a reusable consumer appears.                                                                                                   |
| App icon SVG                         | `static/branding/vici-app-icon.svg` (PWA / favicon)                                                           | ✅ Done. Wired in [`app.html`](../../../src/app.html) as the SVG favicon, iOS touch icon, web manifest icon, and link-preview image set. PNG favicons are kept as fallbacks. |
| Signal icons (`yes` / `no` / `hold`) | [`IconSignalYes`](../../../src/lib/components/icons/IconSignalYes.svelte) / `IconSignalNo` / `IconSignalHold` | ✅ Done. Audit + swap into the prediction interface as a separate `style(market)` commit if the bespoke vectors render better small.                                         |
| Streak-flame icon                    | [`IconStreakFlame`](../../../src/lib/components/icons/IconStreakFlame.svelte)                                 | ✅ Done. Distinct from `FlameChar.svelte` (the animated character).                                                                                                          |
| Laurel icon                          | [`IconLaurel`](../../../src/lib/components/icons/IconLaurel.svelte)                                           | ✅ Done. Non-square (200×120); pass `size` as the height.                                                                                                                    |
| XP chevron                           | [`IconXpChevron`](../../../src/lib/components/icons/IconXpChevron.svelte)                                     | ✅ Done.                                                                                                                                                                     |
| Grain texture                        | `static/branding/grain.svg` (use as a CSS `background-image`)                                                 | ✅ Done. Layered into [`Background.svelte`](../../../src/lib/components/layout/Background.svelte) as a 200×200 tiled overlay with `mix-blend-mode: overlay` and 5% opacity.  |
| Laurel watermark                     | `static/branding/laurel-watermark.svg`                                                                        | ✅ Done.                                                                                                                                                                     |

When adding bespoke icons, register them in
[`reusability.md`](./reusability.md) so the next agent finds them.

Third-party marks keep their own brand colours. Do not recolour the
Juno footer mark, Internet Computer mark, Google mark, or future Apple
mark with VICI theme tokens. They may sit inside VICI surfaces, but the
SVG paths / fills remain brand-owned.

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

| Component          | App equivalent (search-first)                                                                             | Status  | Notes                                                                                                                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bottom navigation  | [`src/lib/components/layout/MobileNav.svelte`](../../../src/lib/components/layout/MobileNav.svelte)       | ✅ Done | Translucent theme-aware shell, central Flow button emphasis, `t()` labels via `labelKey`, active cascade for `/markets/*`, `/wallet`, `/settings`, `/notifications`.                                                                                   |
| Flow card          | [`src/lib/components/market/FlowCard.svelte`](../../../src/lib/components/market/FlowCard.svelte)         | ✅ Done | Front/back flip, why-now chip, sharp-predictor strip, metadata resolution + sparkline events, user-context block, and card-stack rhythm wired. Sharp-predictor lean still uses available consensus-derived values until a reputation aggregate exists. |
| Market card        | [`src/lib/components/market/MarketCard.svelte`](../../../src/lib/components/market/MarketCard.svelte)     | ✅ Done | Compact editorial discovery card: badges, mono time-remaining, probability blocks, challenge slot.                                                                                                                                                     |
| Mobile appbar      | [`src/lib/components/layout/MobileAppBar.svelte`](../../../src/lib/components/layout/MobileAppBar.svelte) | ✅ Done | Per-screen mobile top chrome (`title` or rich `titleChildren`, optional `back`, optional `right` snippet). Hidden on `md+`. Used on Markets, Market Detail, Profile, Portfolio, Social.                                                                |
| Ticker             | [`Ticker.svelte`](../../../src/lib/components/layout/Ticker.svelte)                                       | ✅ Done | Marquee on `/welcome`; `--ticker-h`, `ticker.consensus` i18n label, reduced-motion safe.                                                                                                                                                               |
| UI primitives      | `$lib/components/ui/{Button,Card,Badge,Dialog,Modal,Tabs,Tooltip,…}.svelte`                               | ✅ Done | Button, Badge, Tabs, Card, Modal, StatCard, and settings primitives use tokenized variants; `Tabs.svelte` supports localized labels while preserving stable values. `AppearancePicker.svelte` remains the canonical theme picker.                      |
| Top header / frame | [`Header.svelte`](../../../src/lib/components/layout/Header.svelte) + `MobileNav`                         | ✅ Done | Theme-aware translucent header, pill nav states, `t()` nav + sign-in, same active cascade as bottom nav.                                                                                                                                               |
| Characters         | _see §3_                                                                                                  | ✅ Done |                                                                                                                                                                                                                                                        |

---

## 5. Screens

| Screen            | App equivalent                                                                                                                                                                                                                                                                                | Status  | Notes                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flow Mode         | [`src/lib/components/market/FlowMode.svelte`](../../../src/lib/components/market/FlowMode.svelte) + [`FlowCard.svelte`](../../../src/lib/components/market/FlowCard.svelte)                                                                                                                   | ✅ Done | Swipe deck with brand-aligned typography, generative artwork in-card, top session chrome, footer hint rail, 80 ms commit-feedback beat, named haptic patterns, daily-streak Flame chip, reward ladder, character bubbles (priority-resolved), and a brand-voice FlowEnd. Buttons + keyboard shortcuts kept as accessibility fallback. See §7 below for the rules. |
| Markets list      | [`MarketsPage.svelte`](../../../src/lib/components/pages/MarketsPage.svelte)                                                                                                                                                                                                                  | ✅ Done | Compact editorial discovery list, tab labels, filter chrome, probability blocks, skeletons, and empty state wired through `t()` (EN · IT · ES · DE · FR · PT).                                                                                                                                                                                                    |
| Market detail     | [`MarketDetailHeader.svelte`](../../../src/lib/components/market/MarketDetailHeader.svelte) + [`MarketDetailForecast.svelte`](../../../src/lib/components/market/MarketDetailForecast.svelte) + [`PredictionInterface.svelte`](../../../src/lib/components/market/PredictionInterface.svelte) | ✅ Done | Detail header, resolution/crowd modules, sparkline, branded YES/NO signal icons, token colour classes, and decorative icon hiding while preserving trade handlers, order-book polling, and sizing math.                                                                                                                                                           |
| Onboarding        | [`OnboardingFlow.svelte`](../../../src/lib/components/onboarding/OnboardingFlow.svelte)                                                                                                                                                                                                       | ✅ Done | Pre-sign-in four-step flow on `/signup`: first call, gesture practice, category picks, identity handoff, starter pack, and recoverable email capture.                                                                                                                                                                                                             |
| Profile           | [`ProfilePage.svelte`](../../../src/lib/components/pages/ProfilePage.svelte) + `ProfileDashboard.svelte`                                                                                                                                                                                      | ✅ Done | Performance identity surface with avatar/handle, archetype, level/XP progress, stats grid, recent activity blocks, achievements, and existing profile edit flow.                                                                                                                                                                                                  |
| Social            | [`LeaderboardPage.svelte`](../../../src/lib/components/pages/LeaderboardPage.svelte)                                                                                                                                                                                                          | ✅ Done | Lives at `/social`; the visible surface is Social with Global / Week / Friends / Activity tabs, top-entry cards, current-user highlighting, and existing leaderboard feed.                                                                                                                                                                                        |
| Wallet            | [`WalletPage.svelte`](../../../src/lib/components/pages/WalletPage.svelte)                                                                                                                                                                                                                    | ✅ Done | Treasury section header, wallet stats, collateral stats, send/receive/history tabs, and supporting surfaces use the shared card/chrome language while preserving wallet actions.                                                                                                                                                                                  |
| Market resolution | [`MarketResolutionInterface.svelte`](../../../src/lib/components/market/MarketResolutionInterface.svelte) + `ResolvedMarketPanel.svelte`                                                                                                                                                      | ✅ Done | Resolved panel settlement copy i18n; admin settle form stays English (operator surface).                                                                                                                                                                                                                                                                          |

---

## 6. Landing page

The app does not currently expose a public landing surface. Adding one
would introduce a new top-level route — surface the discussion in the
PR before doing so (see [structure rule](./structure.md#top-level-src)).

| Surface                                      | App equivalent                                                                             | Status  | Notes                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------ |
| Landing page                                 | [`WelcomePage.svelte`](../../../src/lib/components/pages/WelcomePage.svelte) at `/welcome` | ✅ Done | Public hero, ticker, product mockup/card stack, live questions, FAQ, CTAs; full six-locale `t()` for landing keys. |
| Landing sections (hero / ticker / FAQ / CTA) | `WelcomePage` + [`Ticker.svelte`](../../../src/lib/components/layout/Ticker.svelte)        | ✅ Done | Ticker marquee, product loop, trust, and FAQ blocks on welcome route.                                              |

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
and rendered by
[`src/lib/components/artwork/FlowArtFrame.svelte`](../../../src/lib/components/artwork/FlowArtFrame.svelte).
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
Artwork is theme-aware: `dark` defines neutral / won / lost palettes;
`light` and `peach` define neutral palettes and reuse neutral for
resolved states. `FlowArtFrame` passes the active theme from
`theme.store.ts` into `renderFlowArt`, so previews react immediately
when the user switches appearance.

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

## 8. Routing & sign-in shell

The product splits into two layers: a public layer (sign-in,
sign-up, OAuth callbacks) and the gated `(app)` group. SvelteKit
file-based routes — there is no central nav store.

### 8.1 Auth gate

`src/routes/(app)/+layout.svelte` gates every route in the group.
It reacts to `userSignedOutResolved` from
[`src/lib/derived/user.derived.ts`](../../../src/lib/derived/user.derived.ts)
— the `authBusy`-aware derived store that's only `true` after the
initial auth handshake has resolved to "definitely signed out".
Reacting to `authBusy` directly would bounce users to `/signin`
during a normal page load.

When the gate triggers, redirect via `goto(PublicPath.SignIn,
{ replaceState: true })` so the back-button doesn't loop the user
back into the gated route.

### 8.2 Public surfaces

| Path               | Purpose                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/signin`          | Returning-user sign-in surface (`SignInScreen` mode `"signin"`). Welcome-back framing. Routes signed-in users straight to home.                            |
| `/signup`          | Pre-sign-in onboarding flow. Collects a first call, gesture practice, category interests, handle, and optional email before sending the user to `/signin`. |
| `/auth/callback/*` | OAuth callback handlers (Google today). Public — `signInWithGoogle` redirects through these.                                                               |

`PublicPath` enum + `isPublicPath(pathname)` helper live in
[`src/lib/constants/routes.constants.ts`](../../../src/lib/constants/routes.constants.ts).

### 8.3 Onboarding

[`src/lib/components/onboarding/OnboardingFlow.svelte`](../../../src/lib/components/onboarding/OnboardingFlow.svelte)
is the canonical create-account prelude. It has exactly four steps:

1. **First call** — one live swipeable market card. There is no Begin
   button; the user commits with a YES / NO swipe or the accessible card
   buttons. Commit triggers a first-call celebration with rings, sparks,
   `FIRST CALL`, `Called it.`, and `+50 XP` before advancing.
2. **Gestures** — one practice card. The user must tap to reveal details
   and swipe up to skip before the `Got it` button appears.
3. **Categories** — six FlowArt-backed tiles:
   `macro`, `crypto`, `politics`, `tech`, `sports`, `culture`. Require at
   least three selections. Show a small deck preview once the third
   category is selected.
4. **Identity** — starter-pack hero, handle input, optional non-blocking
   email input, social proof, and `Enter VICI →`.

The archetype step is not part of onboarding. Post-auth layouts must not
gate on `profile.archetype`; if pre-sign-in onboarding data is available,
apply the handle and interests to the profile after authentication and
clear the pending handoff.

### 8.4 SignInScreen — visual shell

[`src/lib/components/authn/SignInScreen.svelte`](../../../src/lib/components/authn/SignInScreen.svelte)
is the canonical sign-in / sign-up visual:

- Tracked-out `WELCOME BACK` / `WELCOME` eyebrow (`.allcaps`).
- Display sans + serif italic title — `Sign in to *VICI.*` /
  `Start predicting on *VICI.*`. Wordmark italicised in `.serif-italic`,
  in `--laurel`.
- Sub copy in `--text-muted`.
- Provider stack rendered through
  [`SignInActions.svelte`](../../../src/lib/components/authn/SignInActions.svelte) —
  the four supported methods today: Internet Identity, Google,
  Passkey (WebAuthn), Dev (local only).
- Footer switcher between sign-in and sign-up modes.
- Legal fineprint at the bottom of the page (terms, privacy,
  play-money preview disclaimer).

**Out of scope today**: Apple Sign-In (Juno's auth provider list
covers `internet_identity` / `google` / `github` / `webauthn` /
`dev` only — adding Apple needs a custom OAuth flow on top of
Juno's delegation system) and email magic-link.

### 8.5 Bottom-nav active state

The mobile tab bar
([`MobileNav.svelte`](../../../src/lib/components/layout/MobileNav.svelte))
exact-matches `page.url.pathname` to the nav button's path, with
two cascade rules:

1. The Markets nav button (configured as `AppPath.Home` since the
   markets feed lives at `/`) lights up for any
   `/markets/[id]` detail route.
2. The Profile nav button lights up on `/wallet` (which has no
   nav slot of its own).

If new nav-less routes are added (e.g. `/notifications`,
`/settings` — both deferred), they extend this cascade table.

### 8.6 Dev-only Tweaks panel

[`src/lib/components/dev/TweaksPanel.svelte`](../../../src/lib/components/dev/TweaksPanel.svelte)
is a floating wrench-icon FAB, gated by `isDev()` from
[`src/lib/env/app.env.ts`](../../../src/lib/env/app.env.ts).
Currently provides quick-jumps to every nav-relevant route plus a
sign-out trigger. Theme switching (Dark / Light / Peach) lands
when the theme system does.

It mounts in the **root** layout
([`src/routes/+layout.svelte`](../../../src/routes/+layout.svelte))
so it's available on the public surfaces too — a QA flow that
needs to bounce between `/signin` and the gated app benefits from
having it everywhere.

---

## 9. Market metadata

The app stores VICI-side market context in the public-read
`market_metadata` collection. This is a layer above the market engine:
it does not change clearing, settlement, payouts, or registry state.
It gives creators/admins a place to attach editorial and UX context used
by Flow cards and market detail.

### 9.1 Data shape

[`src/lib/schema/market-metadata.schema.ts`](../../../src/lib/schema/market-metadata.schema.ts)
defines:

| Field                     | Purpose                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `whyNow`                  | Front-card curation chip (`closing`, `trending`, `new`, `topical`, `social` + text).                                                |
| `events`                  | Up to two timeline annotations for compact sparklines / detail surfaces. Wire direction is `up` / `down`; UI may render +/- glyphs. |
| `resolution`              | Human-readable resolution criteria, source, and optional settle timestamp.                                                          |
| `updatedAt` / `updatedBy` | Audit fields set by the satellite update endpoint.                                                                                  |

The document key is the market/series id.

### 9.2 Authorization

Writes go through the typed satellite update endpoint
`upsertMarketMetadata`. The collection itself is configured as
`read: public`, `write: controllers`; frontend code should never call
`setDoc` directly for this collection.

The satellite authorizes writes if:

- the caller has the app admin role, or
- the caller is the market creator according to the registry canister.

### 9.3 Frontend usage

- Read/write helpers live in
  [`src/lib/services/market-metadata.services.ts`](../../../src/lib/services/market-metadata.services.ts).
- The creator/admin editor lives in
  [`MarketMetadataForm.svelte`](../../../src/lib/components/market/MarketMetadataForm.svelte)
  and is mounted on market detail when the viewer is authorized.
- Flow-card front/back consumers read from this service in
  [`FlowMode.svelte`](../../../src/lib/components/market/FlowMode.svelte)
  (batch load per deck) and pass metadata into
  [`FlowCard.svelte`](../../../src/lib/components/market/FlowCard.svelte).

---

## 10. User market signals

The Flow-card back face needs user-specific context. The derived signal
layer lives in
[`src/lib/utils/market-signals.utils.ts`](../../../src/lib/utils/market-signals.utils.ts)
and
[`src/lib/services/market-signals.services.ts`](../../../src/lib/services/market-signals.services.ts).

| Signal         | Source                                          | Behaviour                                                                                                              |
| -------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `categoryAcc`  | User clearing history + series category mapping | Settled events are grouped by FlowArt category. Positive settled quantity counts as a win. Accuracy is `wins / calls`. |
| `priorCalls`   | User executed clearing events                   | Latest executed event per market. Stores side, display date, and event-time consensus proxy when available.            |
| `followedLean` | Followed users' public trade activity           | Sparse map of followed-user YES/NO activity per market. If there is no usable followed activity, omit the row.         |

These signals are client-derived. They are not persisted in the
metadata collection and do not affect clearing, settlement, or profile
statistics.

---

## Style direction

- Tokens flow through [`src/app.css`](../../../src/app.css) `@theme`;
  per-component styling goes in the component's `<style>` block per the
  [stack-and-patterns rules](./stack-and-patterns.md#tailwind-v4--design-tokens).
- For spacing, sizing, radii, and most typography use Tailwind v4
  utilities. Only add a token to `src/app.css` when a real consumer
  needs a value Tailwind can't express.

---

## Recent alignment commits

Track substantive design alignment commits here (not every typography
tweak). Drop entries that no longer reflect the current product.

| Commit                                            | Summary                                                                                                                                                                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `style(ui): align primitives and app chrome`      | Retunes Card, Button, Badge, Tabs, SectionHeader, StatCard, Header, and MobileNav around the app shared card / chip / pill / translucent chrome language.                                                                        |
| `style(auth): align public onboarding surfaces`   | Aligns `/signin`, `/signup`, and `/welcome` around the compact sign-in shell, visual Apple/email placeholders, four-step onboarding, starter pack, product mockup, and landing rhythm.                                           |
| `style(market): align flow and question detail`   | Aligns Flow cards, Flow back face, market detail header, forecast/action modules, stats, and info panels around the question-detail anatomy while preserving swipe timing, trade execution, order-book polling, and sizing math. |
| `style(social): align retention surfaces`         | Reframes Social, Profile, and Portfolio as a connected retention loop: Social tabs and top-entry cards, performance-identity profile, recent activity blocks.                                                                    |
| `style(app): polish supporting surfaces`          | Polishes market discovery, wallet, settings, notifications, empty/loading states, and supporting widgets with the shared card/chrome language.                                                                                   |
| `fix(ui): tighten mobile theme and screen chrome` | Theme-coherent peach/light controls, compact theme picker, scoped sign-in provider styling, mobile-first hide of the desktop header/footer/challenge FAB on mobile pages, reduced onboarding coach background.                   |
| `feat(ui): add per-screen mobile appbars`         | New `MobileAppBar` primitive plus per-screen mobile appbars on Markets, Market Detail, Profile, Portfolio, Social.                                                                                                               |
