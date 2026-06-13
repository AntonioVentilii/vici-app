# Flow Motion System v3 — engineering handover

As-built spec for VICI Flow's motion & reward layer. Shipped and live (13 Jun 2026).

## Contents
- **`Flow Motion System v3 (standalone).html`** — the full spec, self-contained
  (no network needed). Open in any browser. Includes the interactive cadence
  simulator (drag the deck; toggle New / Returning / Lapsed; finish 10, push to
  15; cross a tier to see the §03b beat→trophy sequencing). This is the
  **normative** document: §03's priority table, the simulator's timings, and
  §03b's sequencing contract are the spec; the §05 checklist is the acceptance
  criteria.
- **`motion-engine.js`** — the authoritative live engine that decides *which*
  beat fires. Pure JS, no deps. Contract is documented in its header comment;
  public entry is `recordSwipe({...}) → { bonusXp, beat|null, state }`.

## How they relate
The standalone HTML is the **what and why** (behavioral drivers, cadence,
priority, the no-collision rule). `motion-engine.js` is the **what ships** for
beat selection. The rest of the live layer is mapped in the spec's
"Implementation handoff" block (§05): `flow.jsx` (deck surface), `app.jsx` /
`FlowMode` (orchestration + the `__viciBeatActive` / `vici-beat-change`
sequencing), `app.css` (keyframes), `flow-sound.js` (audio), `characters.*`
and `menagerie.*` (gap characters + trophy reveal).

## Source of truth for numbers
Durations, thresholds, jitter windows, and reward values are authoritative in
`motion-engine.js` and mirrored in the simulator. **If the spec and the shipped
engine ever disagree, the engine wins** — read it, don't re-derive it.

## Critical edge case (must survive any rebuild)
The trapped-flag guard (§03b): a character beat's end event only fires inside
Flow. If the user leaves Flow mid-beat, `__viciBeatActive` sticks `true` and
every future achievement reveal is silently suppressed. Force-clear it whenever
the route isn't `flow`. This shipped as a live hotfix after the original
collision fix — it is part of the contract.
