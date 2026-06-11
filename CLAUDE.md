# CLAUDE.md

Claude-specific runtime layer. **[`docs/ai/`](./docs/ai/) is the source
of truth.** [`AGENTS.md`](./AGENTS.md) is the canonical entry for all
agents; this file only adds Claude-only runtime hints.

> **Mandatory first step:** read [`AGENTS.md`](./AGENTS.md). Then read
> the matching area README before touching code:
>
> - Frontend → [`docs/ai/frontend/README.md`](./docs/ai/frontend/README.md)
> - Juno satellite → [`docs/ai/satellite/README.md`](./docs/ai/satellite/README.md)
> - On-chain backend (icdc-core) → [`docs/ai/backend/README.md`](./docs/ai/backend/README.md)

The thin Claude-runtime cards under
[`.claude/rules/`](./.claude/rules/) are pointers to the canonical
pages — they never override `docs/ai/` (see the
[truth hierarchy](./docs/ai/governance.md#truth-hierarchy)).

---

## Spec-driven development

For net-new features, improvements, and non-trivial bugfixes there is
a spec-first workflow —
[`docs/ai/spec-driven-development/workflow.md`](./docs/ai/spec-driven-development/workflow.md).

**Always ask before using it.** When the user describes such a change
without naming the workflow, mention it exists and ask whether to use
it. If they decline, or the change is clearly too small for a spec,
implement directly. When implementing a spec, read
[`docs/ai/PRODUCT.md`](./docs/ai/PRODUCT.md) first and update it in
the same PR as the behaviour change. Treat `Implemented` specs as
history, never as current behaviour.

---

## Before declaring done

The full quality-gate matrix lives in
[`docs/ai/pr-and-ci.md`](./docs/ai/pr-and-ci.md#4-local-quality-gates).
At minimum, from the repo root:

```bash
npm run quality   # = format + lint (prettier --check + eslint + i18n)
npm run check     # svelte-check
```

If you touched the satellite, also `npm run juno:functions:build` and
commit the regenerated files. If you ran `npm run did`, commit
`src/declarations/**` together with the FE wiring change.

---

## Meta-update rule

If a PR introduces a new pattern, naming convention, shared component,
shared type, or workflow, update the relevant page under
[`docs/ai/`](./docs/ai/) in the same PR — see the
[meta-update rule](./docs/ai/governance.md#meta-update-rule). The
`.claude/rules/` cards stay thin pointers; new substance always lands
in `docs/ai/` first.

When editing `docs/ai/**` itself (auto-writing the agentic docs),
follow the
[writing-for-agents rules](./docs/ai/governance.md#writing-for-agents--meta-rules-for-docsai)
— only non-discoverable signal goes in, tool-specific layers stay
thin, prefer fixing root cause over documenting around it.
