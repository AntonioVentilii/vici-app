# Frontend AI Guide

If you are about to touch anything under `src/lib/`, `src/routes/`, or the
top-level `src/*.{css,html,d.ts}` files, this is your starting point. Read
it once per session.

> Higher up the chain: [`AGENTS.md`](../../../AGENTS.md) → [`docs/ai/`](../README.md).

## Pre-flight checklist (every change)

- [ ] I read [`AGENTS.md`](../../../AGENTS.md) and the
      [10 commandments](../../../AGENTS.md#2-the-10-commandments-read-before-every-change).
- [ ] I know which folder my code belongs in — see [`structure.md`](./structure.md).
- [ ] I checked [`reusability.md`](./reusability.md) for an existing
      component / util / store / service before creating one.
- [ ] My code follows [`stack-and-patterns.md`](./stack-and-patterns.md)
      (Svelte 5 runes, named `Props` interface, no `any`).
- [ ] If I'm aligning a screen / token / asset with the app design, I
      checked and updated [`design.md`](./design.md) in the same PR.
- [ ] No bare clickable `<div>`s; labelled inputs; `aria-hidden` on
      decorative icons — [`a11y.md`](./a11y.md).
- [ ] Terminology check: **prediction**, never "bet". `_ms` for milliseconds,
      `_ns` for nanoseconds.
- [ ] I have or extended tests where the [`testing.md`](./testing.md) policy
      requires (note: testing is currently opt-in — see that page).
- [ ] No `0n` literals; no relative imports across folders under `src/`;
      no `return undefined;` (eslint enforces).
- [ ] Local quality gates pass —
      [`../pr-and-ci.md`](../pr-and-ci.md#4-local-quality-gates).
- [ ] PR title + body match conventions — [`../pr-and-ci.md`](../pr-and-ci.md).
- [ ] If I introduced a new pattern, I updated `docs/ai/**` in the same PR
      ([meta-update rule](../governance.md#meta-update-rule)).

## Stack at a glance

- **SvelteKit 2 + Svelte 5 (runes)**, TypeScript everywhere.
- **Tailwind v4** (`@tailwindcss/postcss` + `@tailwindcss/vite`) with the
  design tokens defined in [`src/app.css`](../../../src/app.css)
  (`primary`, `background`, `card`, `card-border`, …).
- **Lucide** for icons (`lucide-svelte`).
- **`@junobuild/core`** for the auth + datastore client.
- **`@icp-sdk/canisters`** + **`@dfinity/utils`** for IC actor / utility
  plumbing.
- **`ethers`** for ETH-side helpers (used in collateral flows).
- **`decimal.js`** for fixed-precision math; **`nanoid`** for IDs.
- **ESLint preset:** `@dfinity/eslint-config-oisy-wallet` (svelte + vitest
  configs). Local rule `local-rules/no-relative-imports` is **`error`** under
  `src/**`. `0n` and `return undefined;` are also flagged. See
  [`eslint.config.js`](../../../eslint.config.js).
- **No test runner is wired yet** — see [`testing.md`](./testing.md). When
  the first Vitest spec lands, that page becomes the contract.
- **Path aliases** (declared in
  [`svelte.config.js`](../../../svelte.config.js)): `$declarations`,
  `$routes`, `$satellite`, `$root`. The default `$lib` (= `src/lib`) is
  provided by SvelteKit.

## Where things go (one-liner)

```
src/
├── app.{css,html,d.ts}        Theme tokens, base HTML, ambient types
├── routes/                    SvelteKit shell — single page mounts the app
│   ├── (app)/+page.svelte     Hosts the navigation router (nav.store)
│   └── auth/                  OAuth callback + delegation handling
├── lib/
│   ├── components/            UI grouped by feature (admin, market, wallet, social, …)
│   │   └── ui/                App-local UI primitives (Button, Card, Modal, …)
│   ├── services/              Side-effectful orchestration (`*.services.ts`)
│   ├── api/                   Wrappers around generated declarations (`*.api.ts`)
│   ├── canisters/             IC actor factories (`*.canister.ts`)
│   ├── stores/                Svelte stores
│   ├── derived/               Derived stores
│   ├── schema/                Zod schemas for typed boundaries
│   ├── validation/            Validation helpers
│   ├── enums/                 Plain TS enums (UserRole, Permission, …)
│   ├── types/                 TS interfaces / types
│   ├── constants/             Static config / lookup tables / route paths
│   ├── utils/                 Pure helpers — no I/O, no DOM
│   ├── actors/                Generic actor helpers
│   └── actions/               Svelte `use:` actions (e.g. click-outside)
├── satellite/                 Juno satellite (TS canister functions) — see ../satellite/
└── declarations/              Generated bindings (DO NOT hand-edit)
```

Full taxonomy and naming conventions: [`structure.md`](./structure.md).

## What "good" looks like in this repo

A 10x change is small, focused, and reuses what's there. Recent merged PRs
to learn from (from `git log` on `main`):

- `fix(collateral): use nanoid for operation IDs (replaces insecure Math.random fallback)`
  (#75) — single bug, contained fix, calls out the security angle.
- `feat: count docs instead of list` (#65) — single primitive change, swaps
  an O(n) read for the dedicated counter.
- `feat: upgrade juno functions v0.9 and drop candid for ledger transfer`
  (#64) — single dependency upgrade, removes an old code path in the same
  step because it's part of the upgrade.
- `fix: market resolution & settlement UX` (#51) — bounded UX fix.

If your PR doesn't look like one of those (single verb, single concern,
small diff), reconsider scope before continuing.
