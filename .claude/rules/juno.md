# Juno Integration Rules

## External Reference
- **Authoritative Docs**: [Juno LLM Documentation](https://juno.build/llms-full.txt)

## Overview
Vici uses `@junobuild/core` for backend services on the Internet Computer. It is a client-side architecture where the frontend interacts directly with the Satellite container.

## Key SDK Functions (`@junobuild/core`)
- **Initialization**: `initSatellite()` (typically in `+layout.svelte`).
- **Auth**: `signIn()`, `signOut()`, `onAuthStateChange()`.
- **Datastore**: `setDoc()`, `getDoc()`, `listDocs()`, `deleteDoc()`.
- **Storage**: `uploadFile()`, `deleteAsset()`.

## Satellite Configuration
- **Development ID**: `auamu-4x777-77775-aaaaa-cai`
- **Production ID**: `7scay-7yaaa-aaaal-asxqa-cai`
- **Config**: @juno.config.ts

## Local Development
- **Emulator**: Use `juno emulator start` for local development.
- **Local Console**: [http://localhost:5866](http://localhost:5866).
- **Vite Plugin**: Ensure `@junobuild/vite-plugin` is used in `vite.config.ts` for automatic environment variable injection.

## Data Collections (Datastore)
- **ROLES**: Stores user roles and permissions (`roles` collection).
- **Rules**: Consult `juno.config.ts` for collection rules (read/write permissions).
- **Constants**: See @src/lib/constants/collections.constants.ts.

## Serverless Functions (TypeScript)
- **Location**: `src/satellite/index.ts`.
- **Framework**: Uses `@junobuild/functions`.
- **Hooks (`defineHook`)**: For post-operation logic (e.g., Mutation). See [Juno Mutation Docs](https://juno.build/docs/examples/functions/typescript/mutating-docs).
- **Assertions (`defineAssert`)**: For pre-operation validation. See [Juno Assertion Docs](https://juno.build/docs/examples/functions/typescript/assertion).
- **Canister Calls**: Can be performed within functions (e.g., calling the ICRC ledger). See [Juno Canister Calls Docs](https://juno.build/docs/examples/functions/typescript/canister-calls).

## Best Practices
- **Client-Side Only**: SSR is typically not used with Juno; logic lives in components/stores.
- **Auth Guards**: Use `safeGetIdentityOnce` from @src/lib/services/identity.services.ts to protect authenticated actions.
- **Post-install**: Auth workers must be synced via `npm run postinstall` to `./static/workers`.
- **Modularity**: If `src/satellite/index.ts` grows too large, refactor individual hooks/assertions into separate files within `src/satellite/` and import them into the main index.
