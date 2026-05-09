# Coding Standards (Claude quick-reference)

> **Authoritative sources:**
>
> - Folder taxonomy + naming: [`docs/ai/frontend/structure.md`](../../docs/ai/frontend/structure.md)
> - Patterns: [`docs/ai/frontend/stack-and-patterns.md`](../../docs/ai/frontend/stack-and-patterns.md)
> - Reusability catalog: [`docs/ai/frontend/reusability.md`](../../docs/ai/frontend/reusability.md)
> - 10 commandments: [`AGENTS.md`](../../AGENTS.md#2-the-10-commandments-read-before-every-change)
>
> This card is a Claude-only summary. If it disagrees with the docs
> above, the docs above win.

## Code philosophy

- **Idiomatic.** Write code that is native to the framework / language used.
- **DRY.** Aim for zero code duplication. Extract shared logic into utility
  functions or services.
- **Modularity.** Components and services are small, focused, decoupled.
- **UI library:** prioritise reusing components from `$lib/components/ui/`
  (`Button`, `Card`, `Modal`, `Table`, `Tabs`, …) — see the catalog in
  [`reusability.md`](../../docs/ai/frontend/reusability.md).
- **Theme variables:** use design tokens defined in
  [`src/app.css`](../../src/app.css) via Tailwind utilities (`bg-card`,
  `text-card-foreground`, `border-card-border`) — never hard-coded hex.
- **State management:** for cross-view state, follow the patterns in
  `$lib/stores/` (e.g. `certified.store`).
- **File size:** avoid gigantic files. Refactor large components — see
  [`workflows/refactor-split.md`](../../docs/ai/frontend/workflows/refactor-split.md).
- **Coherence:** keep style, pattern, and logic consistent across the
  codebase.

## File naming & namespacing

### Svelte components

- Convention: `PascalCase.svelte` (e.g. `MarketCard.svelte`).
- Location: UI primitives in `$lib/components/ui/`; feature components in
  `$lib/components/<feature>/`.

### Logical files (TypeScript)

Use **kebab-case** with a functional dot-suffix:

- **Services:** `name.services.ts`
- **Stores:** `name.store.ts`
- **Derived:** `name.derived.ts`
- **API:** `name.api.ts` (canister wrappers)
- **Constants:** `name.constants.ts`
- **Utils:** `name.utils.ts`
- **Schemas:** `name.schema.ts`
- **Types:** `name.ts` in `$lib/types/`

## Documentation & testing

- Every method / function should have a clear docstring when its name
  isn't enough.
- Documentation updates ride along with the code they describe — see the
  [meta-update rule](../../docs/ai/governance.md#meta-update-rule).
- Testing is currently opt-in — see
  [`docs/ai/frontend/testing.md`](../../docs/ai/frontend/testing.md) for
  the forward-looking contract.

## Compliance

- Run `npm run format` and `npm run lint` before completing tasks.
- Keep the eslint disallowed list intact: no `0n` (use `ZERO`),
  no `return undefined;` (use bare `return;`), no relative imports
  across folders under `src/**`.

## Naming conventions

- **Timestamps:**
  - `_ms` — milliseconds (default for business logic).
  - `_ns` — nanoseconds (protocol level, idempotency keys).
- **Terminology:** always **"prediction"** — never "bet" — in
  user-visible text and code identifiers.

## Identity & auth

- Principal source of truth: `src/lib/services/identity.services.ts`.
- Use `getIdentityOrAnonymous` for public views, `safeGetIdentityOnce`
  for authenticated actions.

## Routing

- Single-route architecture using `src/lib/stores/nav.store.ts` in
  `src/routes/(app)/+page.svelte`.
- Main views (Markets, Portfolio, Wallet, …) are components, not
  separate SvelteKit routes.
