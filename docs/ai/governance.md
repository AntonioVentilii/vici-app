# Governance

This page defines what agents may, should, and must not do. It applies to
every agent (Claude Code, Cursor, Copilot, Codex, Aider, opencode, …).

## Truth hierarchy

When two sources disagree, the higher one wins:

1. **The code** (`src/**`, `scripts/**`) — current state of reality.
2. **CI workflows** ([`.github/workflows/**`](../../.github/workflows/)) —
   non-negotiable gates that must be green to merge.
3. **CODEOWNERS** ([`.github/CODEOWNERS`](../../.github/CODEOWNERS)) —
   defines who must approve each path.
4. **This file + sibling pages under `docs/ai/`** — policy.
5. [`AGENTS.md`](../../AGENTS.md) — universal entry, points at the above.
6. **Tool-specific layers** ([`CLAUDE.md`](../../CLAUDE.md),
   [`.claude/rules/`](../../.claude/rules/), `.cursor/rules/`,
   `.github/copilot-instructions.md`). These never contradict 1–5.

If an agent finds a contradiction, the agent **stops and asks** instead of
guessing.

## Roles

You can play any of these roles in a single session — most non-trivial PRs
involve all three, in order. Keep them mentally separated.

### Planner

Decompose the task. Surface trade-offs in plain text _before_ editing files.
For anything > ~50 changed lines or touching > 3 files, write a short bullet
plan and confirm scope with the human.

### Implementer

Execute the plan with **targeted edits**. Strictly follow:

- [`frontend/structure.md`](./frontend/structure.md) and
  [`frontend/stack-and-patterns.md`](./frontend/stack-and-patterns.md) for the
  SvelteKit app.
- [`satellite/structure.md`](./satellite/structure.md) and
  [`satellite/patterns.md`](./satellite/patterns.md) for the Juno satellite.

Run the local quality gates from [`pr-and-ci.md`](./pr-and-ci.md) before
declaring done.

### Reviewer

Before opening / merging, self-review against:

- [project-specific commandments](../../AGENTS.md#2-project-specific-commandments)
- [PR conventions](./pr-and-ci.md)
- [Reusability catalog](./frontend/reusability.md) — flag duplication you
  re-introduced.
- [a11y rules](./frontend/a11y.md).

## Boundaries

These paths are **protected**. Agents may read them, but must not modify
them without an explicit ask in the user prompt.

| Path                                                                   | Reason                                                                            | Owner            |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------- |
| `.github/workflows/**`                                                 | CI integrity. Only `ci(...)` PRs touch these.                                     | repo maintainers |
| `.github/CODEOWNERS`, `.github/actions/**`                             | Review routing & action policy.                                                   | repo maintainers |
| `package.json` (deps), `package-lock.json`                             | New / upgraded dependencies require explicit approval.                            | repo maintainers |
| `dfx.json`, `canister_ids.json`                                        | Canister wiring.                                                                  | repo maintainers |
| `juno.config.ts`, `juno.collections.json`                              | Collection rules + satellite IDs. Schema drift breaks data + auth.                | repo maintainers |
| `src/satellite/satellite.did`, `src/satellite/satellite_extension.did` | Public Candid interface of the satellite. Generated; regenerate, never hand-edit. | —                |
| `src/satellite/api-schemas.ts`                                         | Generated schema bindings used by `defineQuery` / `defineUpdate`.                 | —                |
| `src/declarations/**`                                                  | **Generated** by `npm run did` from upstream `.did` files.                        | —                |
| `eslint.config.js`, `.prettierrc`, `tsconfig*.json`                    | Lint / format / TS policy.                                                        | repo maintainers |
| `scripts/build/**`, `scripts/lib/**`, `scripts/init/**`                | Reproducible-build + bootstrap pipeline. Touch only when prompted.                | repo maintainers |
| `static/workers/**`                                                    | Synced from `@junobuild/core` by `npm run postinstall`. Don't hand-edit.          | —                |
| `node_modules/`, `target/`, `.svelte-kit/`, `build/`, `out/`, `.dfx/`  | Build output. Never commit.                                                       | —                |
| `../icdc-core/**`                                                      | External repo. Open it as a separate workspace; obey its `AGENTS.md`.             | icdc-core team   |

If a change must touch a protected path, call it out explicitly in the PR
description.

## Capabilities — quick reference

### Allowed without prompting

- Edit any file under `src/lib/**`, `src/routes/**`, `src/satellite/services/**`,
  `src/satellite/utils/**`, and `src/satellite/index.ts`.
- Edit `src/app.css`, `src/app.html`, `src/app.d.ts`, `src/custom-events.d.ts`.
- Add files inside the existing folder taxonomy
  ([FE structure](./frontend/structure.md),
  [satellite structure](./satellite/structure.md)).
- Run `npm run format`, `npm run lint`, `npm run check`, `npm run quality`,
  `npm run dev`, `npm run build`, `npm run did`,
  `npm run juno:functions:build`, `npm run init:icdc` (and its sub-scripts),
  `npm run test:engine-sync`, `npm run deploy`.
- Update these `docs/ai/**` pages when the meta-update rule fires.

### Forbidden without explicit prompt

- Add a new dependency or upgrade one (`package.json`).
- Add a new top-level folder under `src/` or `src/lib/` /
  `src/satellite/`.
- Edit any path in the [Boundaries](#boundaries) table.
- Disable an ESLint rule, suppress a `svelte-check` warning, or use `any` /
  `as unknown as …` to bypass a type.
- Skip / `.skip()` / `.todo()` an existing test once a test runner is wired.
- `git push --force`, amend a pushed commit, rebase to "tidy history", or
  rewrite shared history. "Explicit prompt" means the user names the
  operation directly — any unambiguous phrasing works (e.g.
  "force-push", "force push", "push --force", "push -f", "amend",
  "git commit --amend", "rebase", "git rebase", "rewrite history").
  Task-level delegation like "do what you think is best" or "do what's
  most correct" does **NOT** count. See
  [`pr-and-ci.md#updating-an-existing-pr`](./pr-and-ci.md#updating-an-existing-pr).
- Commit secrets, `.env*` (other than examples), or large binaries.
- Touch `src/satellite/satellite.did` or `src/declarations/**` by hand
  — regenerate via the appropriate scripts (`juno functions build`, `npm run did`).
- Modify the on-chain Rust canisters in `../icdc-core/` from this repo.
  If a change requires a new endpoint there, do that work in the
  `icdc-core` repo, then come back here for the binding regeneration and
  client wiring.

## Meta-update rule

> If a PR introduces a new pattern, new shared component, new shared type,
> new naming convention, new policy, or a new workflow, the PR **MUST**
> also update the relevant page under `docs/ai/**` so the next agent picks
> it up.

How:

1. Identify which page describes the area you changed:
   - Folder taxonomy → `frontend/structure.md` or `satellite/structure.md`.
   - New shared component / util / service / store → `frontend/reusability.md`.
   - New satellite hook / pattern → `satellite/patterns.md`.
   - New test pattern → `frontend/testing.md`.
   - New PR / CI rule → `pr-and-ci.md`.
   - New policy / boundary → this file.
   - New workflow → add a page under `frontend/workflows/` or
     `satellite/workflows/`.
2. Edit that page in the same PR with the smallest possible delta — add a
   bullet, add a row, swap a code sample.
3. Mention the doc update in the PR body under `# Changes`.
4. If the change is structural enough that the existing taxonomy stops
   making sense, open a separate **doc-only** PR first:
   `docs(ai): <reshape>` — and land it before the code PR.

This is what makes the docs _auto-adapting_: every PR is a small
opportunity to keep them honest. Reviewers should reject code PRs that
introduce a new pattern without the matching doc update.
