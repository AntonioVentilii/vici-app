# CLAUDE.md

Claude-specific runtime layer. Anything not contradicted here defers to
[`AGENTS.md`](./AGENTS.md), which is the canonical entry for **all** agents.

> **Mandatory first step:** read [`AGENTS.md`](./AGENTS.md). Then read the
> matching area README before touching code:
>
> - Frontend → [`docs/ai/frontend/README.md`](./docs/ai/frontend/README.md)
> - Juno satellite → [`docs/ai/satellite/README.md`](./docs/ai/satellite/README.md)
> - On-chain backend (icdc-core) → [`docs/ai/backend/README.md`](./docs/ai/backend/README.md)

---

## Project memory (quick reference)

- **What this is:** prediction-market platform on the Internet Computer.
  SvelteKit (Svelte 5 runes) + Juno satellite + Rust risk engine in
  [`../icdc-core/`](../icdc-core/).
- **Essential commands:** `npm run dev` · `npm run build` · `npm run check` ·
  `npm run quality` · `npm run deploy` · `npm run init:icdc` ·
  `npm run did` (regenerate Candid bindings).
- **Identity:** principal source of truth is
  [`src/lib/services/identity.services.ts`](./src/lib/services/identity.services.ts).
  Use `getIdentityOrAnonymous` for public views and `safeGetIdentityOnce` for
  authenticated actions.
- **Routing:** SvelteKit file-based routes under
  [`src/routes/(app)/`](<./src/routes/(app)/>) (`/`, `/flow`,
  `/markets/[id]`, …). The mobile tab bar
  ([`src/lib/components/layout/MobileNav.svelte`](./src/lib/components/layout/MobileNav.svelte))
  compares `page.url.pathname` to `AppPath` from
  [`src/lib/constants/routes.constants.ts`](./src/lib/constants/routes.constants.ts);
  the visible nav items are configured in
  [`src/lib/constants/nav.constants.ts`](./src/lib/constants/nav.constants.ts).
- **Local replica:** Juno emulator only. **Never** run `dfx start`.

---

## Reasoning preferences

- **Plan briefly, then act.** For non-trivial work (>1 file or >50 lines),
  lay out a 3–6 step plan in plain text before editing files. Keep it tight.
- **Targeted edits.** Use `StrReplace`-style precise edits. Never rewrite an
  entire file when 5 lines change.
- **Explore in parallel.** Batch independent reads / greps / globs in a
  single tool turn. Don't serialize what can be parallel.
- **Stop and ask** if a request is ambiguous about scope, atomicity, or
  policy — better one extra question than a sprawling PR. Especially before:
  - Adding a new dependency (npm).
  - Adding a new top-level folder under `src/`.
  - Touching `src/satellite/satellite.did`, `src/satellite/api-schemas.ts`,
    or generated `src/declarations/**`.
  - Modifying `juno.config.ts` collection rules.
  - Modifying `dfx.json` or `canister_ids.json`.

---

## Coding rules (Claude-specific addenda)

These are on top of the [10 commandments](./AGENTS.md#2-the-10-commandments-read-before-every-change):

- **Read before edit.** Always read a file (or its relevant range) at least
  once before modifying it. The `Read` / `Grep` tools are cheap.
- **Run quality gates.** Before declaring done, run from the repo root:

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

- **Reuse over rebuild.** Before creating a new `.svelte` / `.utils.ts` /
  `.constants.ts` / `.services.ts`, search for an existing one. See
  [`docs/ai/frontend/reusability.md`](./docs/ai/frontend/reusability.md).
- **No new dependencies** without explicit user approval (`package.json`).
- **No new top-level folders** under `src/` or `src/lib/`. The taxonomies in
  [`docs/ai/frontend/structure.md`](./docs/ai/frontend/structure.md) and
  [`docs/ai/satellite/structure.md`](./docs/ai/satellite/structure.md) are
  closed; surface a question instead of inventing a bucket.
- **Comments are for _why_, not _what_.** No narrating comments
  ("// fetch the user"). Only write a comment if it captures intent,
  trade-off, or an invariant the code can't express.
- **Never bypass the eslint disallowed list.** It encodes hard policy
  (`0n` literal → `ZERO`, `return undefined;` → bare `return;`,
  `local-rules/no-relative-imports` under `src/`). See
  [`eslint.config.js`](./eslint.config.js).
- **Never push force / amend pushed commits / rewrite shared history.**
  Add a new commit instead. Approval of a broader task (e.g. "do what you
  think is best", "make the most correct one") is **NOT** approval to
  force-push — the user must name the operation directly using any
  unambiguous phrasing (e.g. "force-push", "force push", "push --force",
  "push -f", "amend", "git commit --amend", "rebase", "git rebase",
  "rewrite history"), or pick a multi-choice option whose label contains
  one of those phrases. When in doubt, add a new commit. See
  [`docs/ai/pr-and-ci.md#updating-an-existing-pr`](./docs/ai/pr-and-ci.md#updating-an-existing-pr).

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
> If you (the AI agent) recognize a change in project behavior, patterns, or
> requirements that differs from these instructions, you **MUST** proactively
> update the relevant doc — usually a page under [`docs/ai/`](./docs/ai/) —
> in the same PR. See the
> [meta-update rule](./docs/ai/governance.md#meta-update-rule).
> Use the legacy [`.claude/rules/`](./.claude/rules/) cards only for very
> small, Claude-only quick-references; everything substantive lives in
> `docs/ai/`.

---

## Coordination

- For role-based collaboration with other agents (planner / implementer /
  reviewer), follow [`docs/ai/governance.md`](./docs/ai/governance.md).
- For PR title, scope, body and CI gates, follow
  [`docs/ai/pr-and-ci.md`](./docs/ai/pr-and-ci.md).
- For meta-updates (changing the rules themselves), follow the
  [meta-update rule](./docs/ai/governance.md#meta-update-rule).
