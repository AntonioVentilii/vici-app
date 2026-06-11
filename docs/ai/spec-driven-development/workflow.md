# Spec-Driven Development

Author a spec first, implement it second. Specs are version-controlled
markdown under [`specs/`](./specs/) — the handoff point between a
planning session (Cowork, plan mode, or a human) and the implementing
agent.

**When to use:** net-new features, behaviour improvements, and
non-trivial bugfixes — when the human opts in. If the user describes
such a change without naming this workflow, ask whether to use it.
Skip it for small changes (typo, one-liner): implement directly.

## Non-negotiables

- **Read the guidance first.** Before authoring or implementing any
  spec: [`AGENTS.md`](../../../AGENTS.md), then the area README
  ([frontend](../frontend/README.md) /
  [satellite](../satellite/README.md) /
  [backend](../backend/README.md)). A spec never overrides
  `docs/ai/**` — it sits below it in the
  [truth hierarchy](../governance.md#truth-hierarchy).
- **Ground specs in real code.** Reference actual file paths,
  component names, collection names, enum members. "the market list
  component" is a wish; `src/lib/components/markets/...` is
  actionable. Scan the codebase before finalizing a spec.
- **Every spec carries a status** (see [lifecycle](#spec-lifecycle)).
  An `Implemented` spec is a historical record, **not** current truth
  — for shipped behaviour, the code and [`PRODUCT.md`](../PRODUCT.md)
  win.
- **One spec, one PR.** A spec's implementation lands as a single PR —
  do **not** split it into a stack or a series of partial PRs. The
  spec is the unit of review: status flips, the `PRODUCT.md` update,
  and the divergence check all bind to exactly one PR, and a split
  breaks that binding (which PR flips the status? which one is "the"
  implementation?). This deliberately overrides the general
  prefer-atomic-splits instinct from
  [`pr-and-ci.md`](../pr-and-ci.md). If the work genuinely cannot fit
  one reviewable PR, the spec is too big — split the **spec** first,
  each part with its own status and PR.

## Files

| Path                                | What                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `specs/YYYY-MM-DD-<type>-<slug>.md` | one spec; `type` = `feat` / `impr` / `fix` / `chore`                          |
| `specs/YYYY-MM-DD-<type>-<slug>/`   | optional assets (wireframes, mocks, screenshots) — deleted after merge        |
| [`template.md`](./template.md)      | copy this to start a spec                                                     |
| [`../PRODUCT.md`](../PRODUCT.md)    | living product behaviour — updated in the **same PR** as the behaviour change |

## Spec lifecycle

Every spec header contains one greppable line: `Status: <value>`.

| Status                 | Meaning                                                                                     | Who flips it                                         |
| ---------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `Draft`                | authored, not yet building                                                                  | author                                               |
| `In progress (#PR)`    | implementation PR open — the spec is the source of truth **for this work**; keep it in sync | implementer, when opening the PR                     |
| `Implemented (#PR)`    | merged — frozen decision record; never read as current behaviour                            | implementer, in the implementation PR's final commit |
| `Superseded by <spec>` | replaced by a newer spec                                                                    | author of the new spec                               |
| `Abandoned`            | will not build — keep the why in the spec                                                   | whoever decides                                      |

This is what prevents a dual source of truth: a spec is authoritative
only while `In progress`, and only for its own PR. Everything else
defers to the code and `PRODUCT.md`.

## Required content by area

**Frontend — artifacts welcome (optional).** Put HTML mocks,
wireframes, or screenshots in the spec's asset folder and link them
relatively from the spec. They exist to tweak against during the
build, not to live forever — post-merge cleanup deletes them; git
history retains them.

Interactive HTML mocks must additionally:

- **Show theme swaps.** When the change touches anything that varies
  by theme — layout, styles, colors, sizing, icons, animations — the
  mock includes a theme switcher and renders each variant the way the
  app does (`data-theme` on the root, light and dark at minimum). A
  single-theme mock leaves the other theme to the implementer's
  imagination, which is where regressions start.
- **Close the loop back to the agent.** The mock gives the reviewer an
  easy way to hand their decisions back to the chat — e.g. a "copy
  instructions" button that copies the **complete** final
  instructions: every chosen variant and tweaked value, restated in
  full, not just the deltas the reviewer happens to remember. The
  copied text alone must be enough for the agent to act on.

**Satellite / backend — technical requirements are mandatory.** Any
spec touching `src/satellite/**`, collections, or icdc-core-facing
paths must state, with numbers where possible:

- **Performance** — expected call frequency; instruction-budget impact
  of new hooks / endpoints (satellite code runs under IC instruction
  caps).
- **Memory & storage** — new collections or doc shapes, expected doc
  count and size, growth rate, retention / cleanup story.
- **Scalability** — behaviour at 10× / 100× current users / markets;
  bulk reads and pagination over N+1 fan-outs.
- **Upgrade & compatibility** — schema changes, regenerated `.did` /
  bindings, breaking or not (`!` title + `BREAKING CHANGE:` block per
  [`pr-and-ci.md`](../pr-and-ci.md#1-pr-title)).
- **Security** — collection rules and caller permissions touched.
- **Parameters** — cite the canonical constants file (e.g. the economy
  values under `src/lib/constants/`) instead of restating numbers; a
  copied value goes stale silently.

A backend spec without this section is a `Draft` that is not ready to
build.

## Steps

1. **Describe & clarify** — rough intent → scope, edge cases,
   constraints, acceptance criteria. Search existing code and issues.
2. **Spec** — copy [`template.md`](./template.md) into `specs/`, fill
   it in, status `Draft`.
3. **Build** — read `AGENTS.md` + area README + `PRODUCT.md`, then the
   spec. Flip status to `In progress (#PR)`. Update `PRODUCT.md` in
   the same PR as the behaviour change — the implementer writes it
   while the context is fresh, and `main` never carries code whose
   product description disagrees.
4. **Adjust** — small gap (wrong path, missing edge case): edit the
   spec directly while building. Deeper ambiguity (scope or product
   question): stop, resolve with the human / planning session, update
   the spec, then continue.
5. **Divergence check & close** — before review-ready, diff the
   implementation against the spec and flag gaps. Flip status to
   `Implemented (#PR)` in the final commit.
6. **Post-merge cleanup** — delete the spec's asset folder in a small
   follow-up PR. The spec `.md` stays as the decision record.
