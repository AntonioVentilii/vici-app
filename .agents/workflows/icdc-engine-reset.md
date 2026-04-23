---
description: fresh reset of the icdc-core registry + Vici engine (local or staging)
---

Use this workflow when the registry state is corrupt, after a schema migration, or when
onboarding a new environment. It wipes all engines, role grants, oracles, and series, then
re-registers the Vici engine and reseeds demo markets.

> [!WARNING]
> `--mode reinstall` **erases all registry state**. Only run it on environments where this
> is explicitly acceptable. Production data is never seeded from this workflow.

## Local

Assumes the Juno emulator is running (see [deployment.md](./deployment.md)).

1. Reinstall the registry canister (wipes engine + role + oracle + series state):
   // turbo

```bash
dfx deploy --mode reinstall registry
```

2. Re-register the Vici engine + reseed markets. Optionally export
   `DEV_CREATOR_PRINCIPAL` so your signed-in II user is auto-granted `Creator` +
   `OracleAdmin` on `eng_0` (see
   [../../docs/engine-integration.md](../../docs/engine-integration.md) — "Persistence
   across registry reinstalls"):
   // turbo

```bash
export DEV_CREATOR_PRINCIPAL="<your-II-principal>"   # optional, local-only
npm run init:icdc
```

3. Verify the engine is wired correctly:
   // turbo

```bash
npm run test:engine-sync
```

## Staging

The staging canister IDs are pinned in `src/lib/constants/canisters.constants.ts`. The
`dfx` identity running this workflow must be a controller of the staging registry.

1. Reinstall the registry:

```bash
dfx deploy --network staging --mode reinstall registry
```

2. Register the Vici engine, explicitly pointing at the **production satellite principal**
   (the satellite that Juno Console deploys to for staging/prod):

```bash
VICI_JUNO_SATELLITE_PRINCIPAL=7scay-7yaaa-aaaal-asxqa-cai \
  npm run init:icdc-engine -- --staging
```

3. Reseed oracles + demo markets:

```bash
npm run init:registry -- --staging
```

4. Rebuild and upgrade the satellite so the new `syncRoleToEngine` hooks are live:

```bash
npm run juno:functions:build
```

Then upgrade the satellite via the Juno Console (no CLI equivalent today).

5. Smoke-test:

```bash
npm run test:engine-sync -- --staging
```

## Post-reset sanity check

`npm run test:engine-sync` verifies:

- The Vici engine exists at `eng_0`.
- The satellite principal is in `admins`.
- `allowed_roles` contains both `Creator` and `OracleAdmin`.
- `grant_engine_role` / `revoke_engine_role` round-trip works (local only).

If the script fails, see [icdc-engine-operations.md](./icdc-engine-operations.md) for
manual reconciliation steps.
