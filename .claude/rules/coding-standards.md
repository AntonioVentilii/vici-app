## Code Philosophy

- **Idiomatic**: Write code that is native and idiomatic to the framework/language used.
- **DRY (Don't Repeat Yourself)**: Aim for zero code duplication. Extract shared logic into utility functions or services.
- **Modularity**: Design components and services to be small, focused, and decoupled.
- **UI Library**: Prioritize reusing components from `@src/lib/components/ui/` (Button, Card, Modal, Table, etc.).
- **Theme Variables**: Use the design system tokens defined in `@src/app.css` (e.g., `primary`, `background`, `card`, `card-border`) rather than hardcoded hex values.
- **State Management**: For global or shared state, use the patterns established in `@src/lib/stores/` (e.g., `certified.store.ts`).
- **File Size**: Avoid gigantic files. If a file grows too large, refactor it into smaller, logical modules.
- **Coherence**: Ensure the entire codebase remains coherent and consistent in style, pattern, and logic.

## File Naming & Namespacing

### Svelte Components

- **Convention**: Use `PascalCase.svelte` (e.g., `MarketCard.svelte`, `SignInModal.svelte`).
- **Location**: UI-specific components live in `@src/lib/components/ui/`. Domain components are grouped by feature (e.g., `@src/lib/components/market/`).

### Logical Files (TypeScript)

Use **kebab-case** with a functional dot-suffix:

- **Services**: `name.service.ts` (Logic layer)
- **Stores**: `name.store.ts` (Svelte writeable stores)
- **Derived**: `name.derived.ts` (Svelte derived stores)
- **API**: `name.api.ts` (Canister/Network interface)
- **Constants**: `name.constants.ts` (Static values)
- **Utils**: `name.utils.ts` (Pure helper functions)
- **Types**: `name.ts` (Interfaces/types, located in `@src/lib/types/`)

## Documentation & Testing

- **Docstrings**: Every method and function MUST have a proper, idiomatic docstring.
- **Documentation Updates**: All changes MUST update relevant documentation (READMEs, specs, etc.).
- **Testing**: Every change MUST include tests (or updates to existing tests). _Note: Ensure the project has a configured test runner (e.g., Vitest) before adding suites._

## Compliance

- **Lint & Format**: Always run `npm run format` and `npm run lint` before completing tasks. Ensure no errors remain.

## Naming Conventions

- **Timestamps**:
  - `_ms`: Milliseconds for business logic (expiry, creation).
  - `_ns`: Nanoseconds for protocol level (idempotency keys).
- **Terminology**: Always use **"prediction"** instead of "bet" in user-facing text and code identifiers.

## Identity & Auth

- Principal source of truth: `src/lib/services/identity.services.ts`.
- Use `getIdentityOrAnonymous` for public views and `safeGetIdentityOnce` for authenticated actions.

## Routing

- Single-route architecture using `src/lib/stores/nav.store.ts` in `src/routes/+page.svelte`.
- Main views (Markets, Portfolio, Wallet, etc.) are components, not separate SvelteKit routes.
