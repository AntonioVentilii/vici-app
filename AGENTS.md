# AGENTS.md

Canonical entry point for **all** AI coding agents working in this repository
(Claude Code, Cursor, OpenAI Codex / GPT, Aider, GitHub Copilot, Continue,
opencode, …). If your tool reads `AGENTS.md` automatically, this is the right
file. If it doesn't, point it here.

> **Read this first. Always.** It is short on purpose. Everything deeper lives
> under [`docs/ai/`](./docs/ai/) and is linked below.

---

## 1. What this repo is

Vici is a prediction-market platform on the Internet Computer. The repo is
multi-stack but **frontend-heavy**: the on-chain risk engine lives in a
separate repository ([`icdc-core`](https://github.com/AntonioVentilii/icdc-core),
typically checked out at `../icdc-core/`).

| Stack                    | Path                              | Language                                  | Status                                                           |
| ------------------------ | --------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Frontend                 | `src/`, `src/routes/`, `src/lib/` | SvelteKit 2 + Svelte 5 + TS + Tailwind v4 | **AI-active**                                                    |
| Juno satellite functions | `src/satellite/`                  | TypeScript (`@junobuild/functions`)       | **AI-active**                                                    |
| Generated bindings       | `src/declarations/`               | TS / Candid (generated)                   | **Do not hand-edit**                                             |
| Init / ops scripts       | `scripts/`                        | Bash + Node                               | AI-assisted                                                      |
| dfx wiring               | `dfx.json`, `juno.config.ts`      | JSON / TS                                 | Restricted — boundary, see [governance](./docs/ai/governance.md) |
| CI / infra               | `.github/workflows/`              | YAML                                      | Restricted                                                       |
| **Risk engine (Rust)**   | **`../icdc-core/`**               | Rust (canisters)                          | **External repo — see §4**                                       |

The platform mounts as a single SvelteKit page. Top-level views (Markets,
Portfolio, Wallet, Profile, Admin, …) are components routed via
`src/lib/stores/nav.store.ts`, not separate SvelteKit routes.

---

## 2. The 10 commandments (read before every change)

1. **Always idiomatic.** Use the conventions of the surrounding code (this
   repo's style), not the ones from your training data.
2. **Always atomic.** One logical change per PR. No drive-by refactors. No
   "while I'm here" edits.
3. **Always small.** Prefer 5 small PRs over 1 big PR. Recent merged history
   is the model: `fix(collateral): use nanoid for operation IDs`,
   `feat: count docs instead of list`, `feat: upgrade juno functions v0.9 …`.
4. **Always reusable.** Before adding a new component / util / constant /
   service / store, search for an existing one. Extend the catalog in
   [`docs/ai/frontend/reusability.md`](./docs/ai/frontend/reusability.md)
   instead of duplicating.
5. **Always typed.** No `any`, no `as unknown as …`, no ignored `svelte-check`
   warnings. Generated Candid types from `$declarations/**` are the source of
   truth at canister boundaries.
6. **Always a11y safe.** No bare clickable `<div>`s. Real `<button>` / `<a>`
   elements, labelled inputs, decorative icons `aria-hidden`. See
   [`docs/ai/frontend/a11y.md`](./docs/ai/frontend/a11y.md).
   _(There is no i18n layer yet — keep user copy in components and concentrate
   it where it can later be extracted.)_
7. **Respect the structure.** New code goes in the folder that already owns
   that concern (`$lib/{components,services,stores,derived,api,canisters,utils,constants,types,schema,enums,validation}`,
   `$satellite/{services,utils}`). The taxonomy is closed — see
   [`docs/ai/frontend/structure.md`](./docs/ai/frontend/structure.md) and
   [`docs/ai/satellite/structure.md`](./docs/ai/satellite/structure.md).
8. **Respect terminology.** Use **"prediction"**, never "bet" — in code,
   comments, and any user-visible copy. Time variables end in `_ms`
   (milliseconds — business logic) or `_ns` (nanoseconds — protocol /
   idempotency).
9. **Respect CI.** Run the local gates from
   [`docs/ai/pr-and-ci.md`](./docs/ai/pr-and-ci.md#local-quality-gates)
   before opening a PR.
10. **Don't overengineer.** A 10x engineer ships the smallest correct change.
    No new abstractions unless they remove duplication that already exists.
    No new dependencies without explicit user approval.

---

## 3. Where to look (frontend)

| You're about to…                                       | Read first                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Open any PR                                            | [`docs/ai/pr-and-ci.md`](./docs/ai/pr-and-ci.md)                                                 |
| Touch any frontend file                                | [`docs/ai/frontend/README.md`](./docs/ai/frontend/README.md)                                     |
| Add or move a file                                     | [`docs/ai/frontend/structure.md`](./docs/ai/frontend/structure.md)                               |
| Write Svelte 5 / runes / TS                            | [`docs/ai/frontend/stack-and-patterns.md`](./docs/ai/frontend/stack-and-patterns.md)             |
| Add UI                                                 | [`docs/ai/frontend/reusability.md`](./docs/ai/frontend/reusability.md)                           |
| Add a Svelte component                                 | [`docs/ai/frontend/workflows/new-component.md`](./docs/ai/frontend/workflows/new-component.md)   |
| Add an API call / service / store                      | [`docs/ai/frontend/workflows/new-service.md`](./docs/ai/frontend/workflows/new-service.md)       |
| Split / refactor a component                           | [`docs/ai/frontend/workflows/refactor-split.md`](./docs/ai/frontend/workflows/refactor-split.md) |
| Add user-visible text or interactive elements          | [`docs/ai/frontend/a11y.md`](./docs/ai/frontend/a11y.md)                                         |
| Align a screen / token / asset with the design handoff | [`docs/ai/frontend/design-handoff-audit.md`](./docs/ai/frontend/design-handoff-audit.md)         |
| Add or change tests                                    | [`docs/ai/frontend/testing.md`](./docs/ai/frontend/testing.md)                                   |

---

## 4. Where to look (Juno satellite)

The Juno satellite (`src/satellite/`) holds TypeScript hooks, assertions, and
typed queries/updates that run on the satellite canister. It is **not** the
on-chain risk engine — that lives in `../icdc-core/`.

| You're about to…                                            | Read first                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Touch any satellite file                                    | [`docs/ai/satellite/README.md`](./docs/ai/satellite/README.md)                                 |
| Add a hook / assertion / typed endpoint                     | [`docs/ai/satellite/patterns.md`](./docs/ai/satellite/patterns.md)                             |
| Add a hook (`onSetDoc` / `onDeleteDoc`)                     | [`docs/ai/satellite/workflows/new-hook.md`](./docs/ai/satellite/workflows/new-hook.md)         |
| Add a typed `defineQuery` / `defineUpdate`                  | [`docs/ai/satellite/workflows/new-endpoint.md`](./docs/ai/satellite/workflows/new-endpoint.md) |
| Sync something into the icdc-core registry / Vici engine    | [`docs/ai/satellite/workflows/engine-sync.md`](./docs/ai/satellite/workflows/engine-sync.md)   |
| Reset / repair the registry + engine grants (local/staging) | [`.agents/workflows/icdc-engine-reset.md`](./.agents/workflows/icdc-engine-reset.md)           |

---

## 5. Where to look (backend / risk engine — `../icdc-core/`)

The Rust canisters that power Vici (Clearing + Registry + Shared) live in
[`../icdc-core/`](../icdc-core/). **Do not** modify Rust under
`src/declarations/**` here — those are generated bindings.

| You're about to…                                              | Read                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Understand how Vici talks to icdc-core (Engine model, oracle) | [`docs/engine-integration.md`](./docs/engine-integration.md)                                   |
| Touch the on-chain registry / clearing / minter canisters     | Open `../icdc-core/`. See its [`AGENTS.md`](../icdc-core/AGENTS.md) first.                     |
| Regenerate Candid bindings after an icdc-core upgrade         | [`docs/ai/backend/README.md`](./docs/ai/backend/README.md#regenerating)                        |
| Day-2 ops on the Vici engine (grant/revoke/audit)             | [`.agents/workflows/icdc-engine-operations.md`](./.agents/workflows/icdc-engine-operations.md) |

`docs/ai/backend/README.md` is a thin pointer file: the source of truth for
backend conventions is `../icdc-core/`.

---

## 6. Governance & meta

- **Truth hierarchy** (highest wins on conflict):
  1. **Code** (`src/**`, `scripts/**`) — current state of the world.
  2. **CI** ([`.github/workflows/**`](./.github/workflows/)) — non-negotiable
     checks.
  3. **CODEOWNERS** ([`.github/CODEOWNERS`](./.github/CODEOWNERS)) — review
     routing.
  4. [`docs/ai/governance.md`](./docs/ai/governance.md) — policies & boundaries.
  5. This file (`AGENTS.md`) — universal entry.
  6. Tool-specific layers ([`CLAUDE.md`](./CLAUDE.md),
     `.claude/rules/`, `.cursor/rules/`,
     `.github/copilot-instructions.md`) — never contradict the above.
- **Auto-adapting docs.** When a PR introduces a new pattern, convention,
  shared component, shared type, workflow, or policy, the agent **MUST**
  update the relevant `docs/ai/**` file in the same PR. See
  [`docs/ai/governance.md#meta-update-rule`](./docs/ai/governance.md#meta-update-rule).

---

## 7. Tool-specific entry points

These are thin layers on top of this file. They never contradict it.

- **Claude Code / Anthropic:** [`CLAUDE.md`](./CLAUDE.md) (+ legacy
  [`.claude/rules/`](./.claude/rules/) cards — being absorbed into
  `docs/ai/`).
- **Cursor:** drop a rule under `.cursor/rules/` that points here.
- **GitHub Copilot:** drop `.github/copilot-instructions.md` that points here.
- **OpenAI Codex / Aider / opencode / Continue / …:** read this file
  (`AGENTS.md`).

If you add a new agent / tool, add a tiny pointer file (≤ 30 lines) here that
references this `AGENTS.md` — do **not** duplicate the rules.
