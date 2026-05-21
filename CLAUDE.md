# CLAUDE.md

Claude-specific runtime layer. Anything not here defers to
[`AGENTS.md`](./AGENTS.md), which is the canonical entry for **all** agents.

> **Mandatory first step:** read [`AGENTS.md`](./AGENTS.md). Then read the
> matching area README before touching code:
>
> - Frontend → [`docs/ai/frontend/README.md`](./docs/ai/frontend/README.md)
> - Juno satellite → [`docs/ai/satellite/README.md`](./docs/ai/satellite/README.md)
> - On-chain backend (icdc-core) → [`docs/ai/backend/README.md`](./docs/ai/backend/README.md)

---

## Identity helpers (not discoverable by name)

Principal source of truth is
[`src/lib/services/identity.services.ts`](./src/lib/services/identity.services.ts).
Use `getIdentityOrAnonymous` for public views and `safeGetIdentityOnce` for
authenticated actions. Don't roll your own.

---

## Quality gates Claude must run

Before declaring done, from the repo root:

```bash
npm run format
npm run lint           # prettier --check + eslint
npm run check          # svelte-check
```

If you touched the satellite, also rebuild it:

```bash
npm run juno:functions:build
```

If you regenerated bindings (`npm run did`), commit the regenerated
`src/declarations/**` together with the source.

---

## Tool-use cheatsheet

| Goal                          | Use                                         |
| ----------------------------- | ------------------------------------------- |
| Find files by name            | `Glob`                                      |
| Find code by exact text/regex | `Grep` (prefer over shell `rg`)             |
| Find code by meaning          | `SemanticSearch`                            |
| Read a file                   | `Read` (NOT `cat` / `head` / `tail`)        |
| Edit a file                   | `StrReplace` (NOT `sed` / `awk` / heredocs) |
| Run a one-shot command        | `Shell`                                     |
| Multi-step exploration        | `Task` with `subagent_type: "explore"`      |

---

## Personalize & evolve

> [!IMPORTANT]
> If a PR introduces a new pattern, naming convention, shared component,
> shared type, or workflow, update the relevant page under
> [`docs/ai/`](./docs/ai/) in the same PR. See the
> [meta-update rule](./docs/ai/governance.md#meta-update-rule).
