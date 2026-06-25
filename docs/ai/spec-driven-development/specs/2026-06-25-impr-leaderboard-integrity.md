# Spec: Leaderboard integrity — qualify gate + shrinkage rank

This spec follows the workflow defined in
`docs/ai/spec-driven-development/workflow.md`.

Status: Draft

## Goal

A thin record can no longer top the global leaderboard. Today a predictor
who is right on a single settled call sits at #1 on accuracy alone, above a
seasoned predictor who is right on 45 of 50 — the board rewards luck over a
proven track record. After this change the board only **ranks** predictors
who have cleared a minimum number of resolved calls (default 10), and ranks
those qualified predictors by a **confidence-adjusted score** (Bayesian
shrinkage toward the population mean) rather than raw accuracy, so a thin
10/11 record decays toward average instead of out-ranking a proven 45/50.
Predictors below the threshold are shown — never hidden — in a separate
**Provisional** section with an "{n}/{min} to qualify" progress label, and
**every** leaderboard row now shows its resolved-call count, the trust
signal that makes the ranking legible. The qualifying threshold is exposed
as a dev **Tweak** for live tuning.

## Context

The global leaderboard surface and its FE re-ranking already exist; this
spec replaces the ranking rule and adds the Provisional split + call counts.

- **Ranking (FE re-rank).**
  [`src/lib/derived/standings.derived.ts`](../../../src/lib/derived/standings.derived.ts)
  re-ranks the clearing canister's net-P&L slice by **accuracy** via the
  inline `byAccuracy` comparator, with `LEADERBOARD_MIN_SETTLED = 3` — but
  that 3 is only a **floor that sinks** low-sample predictors below
  everyone who cleared it, not a **gate that unranks** them, and there is
  no shrinkage: a 1-call 100% still beats a 50-call 90% as long as both
  clear 3. `globalStandingsRows(window)` stamps each row's 1-based
  `displayRank`.
- **Surface.**
  [`src/lib/components/pages/LeaderboardPage.svelte`](../../../src/lib/components/pages/LeaderboardPage.svelte)
  renders a 3-tile podium + a flat list of `rest` rows. Each list row's
  meta line shows **net VXP · {n}d streak** (`leaderboard.row.vxp` /
  `leaderboard.row.streak`) — **not** the call count. The settled count
  appears only inside the tapped mini-profile bottom sheet
  (`leaderboard.sheet.settled`, row `entry.settledCount`).
- **Data source.**
  [`src/lib/services/standings.services.ts`](../../../src/lib/services/standings.services.ts)
  (`getStandings` / `loadGlobalStandings`) reads the clearing canister's
  `list_leaderboard` query and maps each wire entry via `toEntry`. The view
  model [`StandingEntry`](../../../src/lib/types/standings.ts) **already
  carries `settledCount`, `winCount`, and `accuracy` for every entry in the
  slice** — not just the tapped profile. This is the load-bearing fact: the
  gate and the shrinkage score need a resolved-call count per predictor for
  **all** rows, and it is already present. No backend change is required to
  read it (see _Open questions_ for the one slice-completeness caveat).
- **Self overlay.** `globalStandingsRows` overlays the viewer's own row
  from the live `userStore.profile`; `LeaderboardPage` hydrates handle /
  avatar / streak for the rows it paints via `loadProfilesByPrincipals`.
  The gate / score read only `entry.*` figures, so they are unaffected by
  the profile overlay.
- **Tweak infra.**
  [`src/lib/components/dev/TweaksPanel.svelte`](../../../src/lib/components/dev/TweaksPanel.svelte)
  is a dev-only (`isDev()`) panel that already drives one tunable
  (`worldCupMode`) through `preferencesStore`
  ([`src/lib/stores/preferences.store.ts`](../../../src/lib/stores/preferences.store.ts),
  `DEFAULT_PREFERENCES`). A numeric leaderboard-qualify tweak follows the
  same write-through-to-profile pattern.
- **i18n.** Existing `leaderboard.*` keys live in
  [`src/lib/constants/messages/en.ts`](../../../src/lib/constants/messages/en.ts)
  (`leaderboard.row.vxp`, `leaderboard.sheet.settled`, …) and the other
  locale catalogs under `src/lib/constants/messages/*.ts`. New copy stays in
  the `leaderboard.*` namespace.

**Point of truth — the prototype.** `VICI-V1.8-Handover` (V1.8.44,
CHANGELOG domain 4): `app.jsx` `VICI_rankScore(acc, calls)` and
`VICI_LB_QUALIFY_MIN` (default 10); `screens.jsx` `LeaderboardScreen`
(~1897–2046). Qualified rows (`calls >= qualifyMin`) sort by `score` desc
and take ranks `1..n`; sub-threshold rows are **Provisional** (sorted by
`calls` desc, unranked) and rendered in a separate section with a
"{n}/{min} to qualify" progress label; every row shows `lb.calls`; the
threshold is a Tweak mirrored to `window.__viciTweaks.lbQualifyMin` so the
board re-ranks live. The shrinkage formula is:

```
rankScore(acc, calls) = (PRIOR·WEIGHT + acc·calls) / (WEIGHT + calls)
PRIOR  = 0.5   (population baseline a thin record decays to)
WEIGHT = 20    (strength of the prior, in "virtual calls")
```

The prototype's demo seeds (`data.js` ~259–272: `quirinus` 1/1, `horatius`
6 calls — added purely to demonstrate the gate) are **not** ported; the
app's standings come from the live clearing canister.

## Scope

1. **Qualify gate replaces the floor.** Promote the magic `3` floor in
   `standings.derived.ts` to a named, configurable threshold (default 10,
   cited from the canonical constants file — see _Decisions_). Below the
   threshold a predictor is **Provisional**: excluded from the ranked
   slots entirely, not merely sunk to the bottom of one list.

2. **Bayesian-shrinkage ranking for qualified rows.** Add a pure
   `rankScore({ accuracy, settledCount })` helper (PRIOR 0.5, WEIGHT 20)
   and sort qualified rows by it (desc), tie-broken by `settledCount` desc
   → `realizedPnl` desc → stable. `accuracy` here is the 0–1 fraction
   (`entry.accuracy` is a 0–100 integer; divide once). This is the single
   definition of leaderboard rank order.

3. **Two row buckets out of `globalStandingsRows`.** Split the joined rows
   into `ranked` (≥ threshold, `displayRank` 1..n by score) and
   `provisional` (< threshold, sorted by `settledCount` desc, **no**
   `displayRank`). Surface both from the derived layer so the page renders
   them without re-deriving the split. The viewer's own row keeps the live
   self-profile overlay in whichever bucket it lands.

4. **Provisional section on the page.** Below the ranked podium + list,
   render a Provisional section (eyebrow header + the min-calls hint) when
   `provisional.length > 0`. Each provisional row shows a "Provisional"
   chip, handle, avatar, accuracy, and the "{done}/{min} to qualify"
   progress label. Rows stay tappable (same mini-profile sheet). No podium
   for provisional predictors.

5. **Call counts on every ranked row.** Add the resolved-call count to each
   podium tile and each ranked list row (`entry.settledCount`), so the
   trust signal is visible without opening the sheet. Keep the existing
   meta (net VXP · streak); the call count is an addition, not a swap (see
   _Pending decisions_ for placement).

6. **Mini-profile sheet: label Provisional.** When the tapped row is
   provisional, the sheet's rank line reads "Provisional" instead of a
   fabricated "#N global" (`leaderboard.sheet.rank_streak` already exists;
   add a provisional variant). The Settled stat is unchanged.

7. **Dev Tweak.** Add a numeric "Leaderboard qualify (calls)" control to
   `TweaksPanel.svelte` (range 0–30), persisted through `preferencesStore`
   (`DEFAULT_PREFERENCES` + the `PartialPrefsInput` / `hydrateShape` /
   `STORE_OWNED_PREFERENCE_KEYS` plumbing), defaulting to the constant. The
   derived re-rank reads the effective threshold so the board re-ranks live
   when the tweak moves.

8. **i18n.** Add `leaderboard.*` keys for the call-count label, the
   Provisional chip + section header, the "{done}/{min} to qualify"
   progress, the min-calls hint, and the provisional sheet line — across
   every locale catalog under `src/lib/constants/messages/*.ts` (the i18n
   lint requires parity). No `lb.*` keys (the prototype namespace is not
   adopted).

9. **`PRODUCT.md`.** Update the leaderboard description to state the
   qualify gate + confidence-adjusted ranking + Provisional bucket, in the
   same PR.

**Explicitly unchanged:**

- The window tabs (week / month / all), the podium layout, the friend
  add/remove flow through `relation.services`, and the dropped ↑/↓
  rank-delta pill all stay as-is.
- The Dash "Top X%" rank tile / `findOwnStanding` / `percentileBand` keep
  reading the canister's **P&L** rank — they are deliberately on a
  different basis (documented in `standings.services.ts`) and are not
  reconciled here (see _Out of scope_).

### Out of scope

- **Moving the gate / shrinkage into the clearing canister.** This spec
  re-ranks the fetched slice on the FE, exactly as the existing accuracy
  re-rank does. Pushing the qualify gate + shrinkage into `list_leaderboard`
  (so high-accuracy / low-P&L predictors aren't dropped before the FE sees
  them, and so the rank is authoritative) is the existing future-work item
  flagged in `standings.services.ts` / `standings.derived.ts` — tracked,
  not done here. See _Open questions_ for the slice-completeness risk this
  leaves open.
- **The Dash rank tile P&L-vs-accuracy split** (the known inconsistency in
  `standings.services.ts`, and the surface of issue #759). Untouched.
- **A user-facing (non-dev) threshold control.** The Tweak is dev-only; the
  10-call default is the shipped value for real users.
- **Anti-farm hardening of the resolved-call count** (gaming the gate by
  manufacturing settled calls). The count is authoritative from the
  clearing canister, so this is weaker than the activity-log gap in #543,
  but any sybil-resistance work on settlement counts belongs there, not
  here.
- **Porting the prototype demo seeds** (`quirinus` / `horatius`).

## Linked issues

No open issue tracks leaderboard ranking integrity (searched the repo's 6
open issues + `leaderboard` / `accuracy ranking` queries). The nearest,
`#759` "Dash looks different", is about the **Dash** rank tile and is
explicitly out of scope; `#543` (anti-farm) is tangential and noted under
_Out of scope_. No closing keyword.

## Analytics

Instrument the leaderboard view, which today emits nothing of its own (the
only capture on the surface is `friend_request_sent` with
`source: 'leaderboard'`). Propose **one new event**:

- **`leaderboard_viewed`** — fired once per window load on
  `LeaderboardPage`. Props (all from the existing bounded
  `AnalyticsEventProps` vocabulary in
  [`src/lib/types/analytics-event.ts`](../../../src/lib/types/analytics-event.ts)):
  - `label` — the active window (`week | month | all`).
  - `count` — number of **ranked** (qualified) rows in the slice.
  - `value` — the **effective qualify threshold** in force (so a Tweak
    change is attributable and the gate's real-world effect — how many
    predictors fall into Provisional — is measurable).

  No new prop dimension is needed. The new name `leaderboard_viewed` must
  land in **both** halves of the dual-source pair:
  `src/lib/types/analytics-event.ts` (TS union) **and**
  `src/lib/schema/analytics-event.schema.ts` (Zod mirror) — svelte-check
  only catches the union; an enum mismatch fails at runtime. Capture via
  `track` in `src/lib/services/analytics.services.ts`. Behavioural only; no
  PII, no free-text — `label` draws from the fixed window set.

No event is added for entering the Provisional bucket: it is derivable from
`leaderboard_viewed` (`count` of ranked rows vs. slice total) without a
per-user event.

## Implementation outline

1. **Constant.** Add the qualify threshold (default `10`) to the canonical
   constants file — `src/lib/constants/vxp-economy.constants.ts` (or a
   sibling under `src/lib/constants/`), exported as a named const with a
   doc comment, alongside the PRIOR (0.5) and WEIGHT (20) shrinkage
   parameters. The spec cites the file rather than restating the numbers
   elsewhere.

2. **`standings.derived.ts`.**
   - Replace `LEADERBOARD_MIN_SETTLED = 3` with the imported threshold;
     accept an effective override (the Tweak) so the default is the
     constant but a dev value re-ranks.
   - Add a pure `rankScore({ accuracy, settledCount })` using PRIOR /
     WEIGHT from the constants file (convert `accuracy` 0–100 → 0–1 once).
   - Replace the single `byAccuracy` sort with: partition rows into
     qualified (`settledCount >= threshold`) and provisional; sort
     qualified by `rankScore` desc → `settledCount` desc → `realizedPnl`
     desc → stable; sort provisional by `settledCount` desc.
   - Change `globalStandingsRows` to return both buckets (ranked rows carry
     `displayRank` 1..n; provisional rows carry no rank), or expose a small
     `{ ranked, provisional }` shape. Keep the self-overlay + the
     "copy before sort, never mutate the cached slice" property.

3. **`LeaderboardPage.svelte`.**
   - Consume the new `{ ranked, provisional }` shape: podium = ranked
     slice(0,3), list = ranked slice(3), plus a Provisional section.
   - Add the call-count to each podium tile + ranked row
     (`entry.settledCount`, `leaderboard.row.calls`).
   - Render the Provisional section (header + min hint) when non-empty;
     each row = chip + avatar + handle + "{done}/{min} to qualify" +
     accuracy; tappable into the existing sheet.
   - In the sheet, render "Provisional" instead of "#N global" when the
     tapped row is unranked.
   - Fire `track({ name: 'leaderboard_viewed', label: window, count, value })`
     in the per-window load effect.

4. **Tweak.** Add `leaderboardQualifyMin` to `DEFAULT_PREFERENCES`,
   `PartialPrefsInput`, `hydrateShape`, and `STORE_OWNED_PREFERENCE_KEYS` in
   `preferences.store.ts` (with a coerce clamp to 0–30); add a numeric
   control to `TweaksPanel.svelte`. The derived layer reads the effective
   value (Tweak value if set, else the constant).

5. **Analytics dual-source.** Add `leaderboard_viewed` to
   `analytics-event.ts` (union) and `analytics-event.schema.ts` (Zod enum).

6. **i18n.** Add the new `leaderboard.*` keys to every catalog under
   `src/lib/constants/messages/*.ts`.

7. **`PRODUCT.md`** leaderboard subsection; then `npm run quality` +
   `npm run check`.

## Acceptance criteria

- [ ] A predictor with fewer than the threshold settled calls never appears
      in a ranked slot or on the podium — they appear only in the
      Provisional section, with a "{n}/{min} to qualify" label.
- [ ] Among qualified predictors a thin record (e.g. 10/11 ≈ 91% raw)
      ranks **below** a proven one (e.g. 45/50 = 90% raw), because the
      shrinkage score pulls the thin record toward the 0.5 prior.
- [ ] `rankScore` matches the prototype formula `(0.5·20 + acc·n)/(20 + n)`
      with `acc` as the 0–1 fraction, for the same inputs.
- [ ] Every podium tile and ranked list row shows its resolved-call count.
- [ ] The mini-profile sheet shows "Provisional" (not a fabricated rank)
      for an unranked predictor, and still shows the Settled stat.
- [ ] Moving the dev "Leaderboard qualify (calls)" Tweak re-ranks the board
      live (rows move between Ranked and Provisional) without a reload; the
      default with no Tweak set equals the constant (10).
- [ ] `leaderboard_viewed` is emitted once per window load with
      `label` ∈ {week, month, all}, `count` = ranked-row count, `value` =
      effective threshold; the name exists in both the TS union and the Zod
      mirror.
- [ ] New copy is `leaderboard.*` (no `lb.*`), present in every locale
      catalog; the prototype demo seeds are not ported.
- [ ] `npm run quality` and `npm run check` pass.

## Open questions

- **Slice completeness under the gate.** `list_leaderboard` returns the
  top-N **by net P&L** (`MAX_STANDINGS_PAGES` × `STANDINGS_PAGE_LIMIT` =
  5,000 principals). The gate + shrinkage re-rank only what the FE fetched.
  While the whole settled population fits in the fetched pages this is
  exact; beyond that, a high-accuracy / low-P&L predictor could be dropped
  from the slice **before** the FE applies the gate — the same pre-existing
  limitation the current accuracy re-rank already has
  (`standings.derived.ts` header). Confirm this is acceptable for launch
  scale; if not, the gate/shrinkage move into the clearing canister
  (already flagged as future work, see _Out of scope_). This is a sizing
  question, not a blocker for the FE change.
- **`accuracy` precision.** `toEntry` rounds `winCount/settledCount` to a
  0–100 **integer** before the FE sees it. Feeding the rounded integer into
  `rankScore` is slightly lossy vs. computing the fraction from
  `winCount/settledCount` directly. Confirm whether to compute the score
  from `winCount`/`settledCount` (preferred — both are on `StandingEntry`)
  rather than the rounded `accuracy`. Likely a no-op decision in favour of
  the raw counts.

## Pending decisions

- **Call-count placement on the row.** Prototype shows
  "{calls} calls · {streak}d streak" on the meta line, replacing nothing —
  but the app's meta line currently reads "{vxp} VXP · {streak}d streak".
  Decide whether the call count joins as a third segment
  ("{vxp} VXP · {calls} calls · {streak}d streak"), replaces the streak, or
  sits as a separate sub-label. Product/visual call; the data is available
  either way.
- **Threshold default value.** The prototype default is 10; the app's
  current floor is 3. Confirm 10 ships as the real-user default (the brief
  records 10 as decided — restated here only to gate the status flip; flip
  to a Decision once the owner confirms against live data volume).

## Decisions

Handed down with the port (recorded here, not re-opened):

- **Adopt the full prototype model.** Qualify gate + Bayesian shrinkage +
  Provisional section + per-row call counts — not a partial port. This is a
  core product-integrity change, hence spec-driven. Chosen over keeping the
  current floor-only behaviour because the floor sinks but does not unrank,
  and has no shrinkage, so thin records still top the board.
- **Keep the app's `leaderboard.*` i18n namespace.** The prototype's `lb.*`
  keys are **not** adopted; the app's namespace scheme stays consistent.
- **Threshold = named constant, default 10, wired to the Tweak, cited from
  the canonical constants file.** A copied number goes stale silently
  (per the workflow's parameters rule), so the value lives once in
  `src/lib/constants/` and both the derived re-rank and the Tweak default
  read it.
- **Keep internal `settled` / `settledCount` naming.** The view model and
  existing i18n (`leaderboard.sheet.settled`) already say "settled"; the
  user-facing "calls" copy is a label choice, the internal field stays
  `settledCount` — no rename.
- **Do not port the demo seeds.** `quirinus` (1/1) and `horatius` (6) exist
  only to demonstrate the gate in the prototype's mock data; the app reads
  live clearing-canister standings.
