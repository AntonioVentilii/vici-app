# Juno Integration (Claude quick-reference)

> **Authoritative sources:**
>
> - Satellite README: [`docs/ai/satellite/README.md`](../../docs/ai/satellite/README.md)
> - Satellite patterns: [`docs/ai/satellite/patterns.md`](../../docs/ai/satellite/patterns.md)
> - External docs: [Juno LLM Documentation](https://juno.build/llms-full.txt)
>
> This card is a Claude-only summary. If it disagrees with the docs
> above, the docs above win.

## Overview

Vici uses `@junobuild/core` for FE auth + datastore client and
`@junobuild/functions` for satellite-side hooks / asserts / typed
endpoints. The frontend interacts directly with the satellite container.

## Key SDK functions (`@junobuild/core`)

- **Initialization:** `initSatellite()` (typically in `+layout.svelte`).
- **Auth:** `signIn()`, `signOut()`, `onAuthStateChange()`.
- **Datastore:** `setDoc()`, `getDoc()`, `listDocs()`, `countDocs()`,
  `deleteDoc()`.
- **Storage:** `uploadFile()`, `deleteAsset()`.

## Satellite configuration

- **Development ID:** `auamu-4x777-77775-aaaaa-cai`
- **Production ID:** `7scay-7yaaa-aaaal-asxqa-cai`
- **Config:** [`juno.config.ts`](../../juno.config.ts).

## Local development

- **Emulator:** `juno emulator start` for local development.
- **Local Console:** [http://localhost:5866](http://localhost:5866).
- **Vite plugin:** `@junobuild/vite-plugin` is wired in
  [`vite.config.ts`](../../vite.config.ts) for env-var injection.

> [!IMPORTANT]
> Do **NOT** run `dfx start`. The Juno emulator is the only local
> replica.

## Data collections

Collection names are pinned in **two** places that must stay in sync:

- [`juno.config.ts`](../../juno.config.ts) — deployment config.
- [`src/lib/constants/collections.constants.ts`](../../src/lib/constants/collections.constants.ts)
  — the typed `Collection` enum used by the satellite + FE.

When adding a new collection, edit both files in the same PR.

## Serverless functions (TypeScript)

- **Location:** [`src/satellite/`](../../src/satellite/).
- **Framework:** `@junobuild/functions`.
- **Primitives:** `defineHook` (post-write), `defineAssert` (pre-write
  veto), `defineQuery`, `defineUpdate`. See
  [`docs/ai/satellite/patterns.md`](../../docs/ai/satellite/patterns.md)
  for the canonical shapes (collection-dispatch tables, idempotent
  hooks, schema-first endpoints).
- **Build:** `npm run juno:functions:build`.

## Best practices

- **Client-side only.** SSR is typically not used with Juno; FE logic
  lives in components / stores.
- **Auth guards.** Use `safeGetIdentityOnce` from
  [`identity.services.ts`](../../src/lib/services/identity.services.ts)
  to protect authenticated actions.
- **Post-install.** Auth workers are synced via `npm run postinstall`
  to `./static/workers`. Don't hand-edit those files.
- **Modularity.** Keep `src/satellite/index.ts` declarative — schemas +
  dispatch tables only. Push logic into `src/satellite/services/`.
