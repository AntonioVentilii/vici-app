# Coding standards (Claude pointer)

`docs/ai/` is the source of truth. This card only surfaces a few
high-violation reminders so they land in Claude's prompt — for anything
substantive, read the canonical docs.

**Read first:**

- Folder taxonomy + file naming + decision tree →
  [`docs/ai/frontend/structure.md`](../../docs/ai/frontend/structure.md)
- Svelte / TS / Tailwind / routing / identity idioms →
  [`docs/ai/frontend/stack-and-patterns.md`](../../docs/ai/frontend/stack-and-patterns.md)
- Reusability catalog (`$lib/components/ui/`, shared utils / stores /
  services) →
  [`docs/ai/frontend/reusability.md`](../../docs/ai/frontend/reusability.md)
- Project commandments →
  [`AGENTS.md`](../../AGENTS.md#2-project-specific-commandments)
- Quality gates + PR conventions →
  [`docs/ai/pr-and-ci.md`](../../docs/ai/pr-and-ci.md)
- i18n catalogs + lint rule →
  [`docs/ai/frontend/i18n.md`](../../docs/ai/frontend/i18n.md)

**Easy-to-miss rules:**

- **Run `npm run quality`** (format + lint + i18n check) before
  declaring done. `npm run check` for svelte-check.
- **ESLint landmines:** no `0n` (use `ZERO` from
  `$lib/constants/app.constants`); no `return undefined;` (bare
  `return;`); no relative imports across folders under `src/**`.
- **Time variables:** `_ms` (milliseconds, default) / `_ns`
  (nanoseconds, protocol-level).
- **Terminology:** always **"prediction"**, never "bet".
- **Reuse first:** check
  [`reusability.md`](../../docs/ai/frontend/reusability.md) before
  creating a new component / util / store / service.
