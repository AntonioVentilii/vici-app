# Backend & Canister Integration (Claude quick-reference)

> **Authoritative sources:**
>
> - Backend pointer: [`docs/ai/backend/README.md`](../../docs/ai/backend/README.md)
> - Engine integration: [`docs/engine-integration.md`](../../docs/engine-integration.md)
> - icdc-core repo: [`../icdc-core/AGENTS.md`](../../../icdc-core/AGENTS.md)
>
> This card is a Claude-only summary. If it disagrees with the docs
> above, the docs above win.

## Overview

The Rust risk engine **does not live in this repo.** It lives in
[`../icdc-core/`](../../../icdc-core/). This repo only consumes its
public Candid surface via generated bindings.

Vici interacts with several canisters on the Internet Computer:

- **Clearing canister** (`../icdc-core/src/clearing/`) — core logic for
  predictions, positions, settlement.
- **Registry canister** (`../icdc-core/src/registry/`) — manages series,
  market metadata, engines, oracles.
- **ICRC ledger canisters** — ICP and ckUSDC token operations.

## Architecture

- **API layer:** logic lives in `$lib/api/` (`clearing.api.ts`,
  `registry.api.ts`, `icrc-ledger.api.ts`, …). Use the established API
  classes for all canister interactions.
- **Actor factories:** `$lib/canisters/<canister>.canister.ts`.
- **Engine model:** Vici registers as engine `eng_0` on the icdc-core
  registry. Read [`docs/engine-integration.md`](../../docs/engine-integration.md)
  before touching any market / oracle path.

## Tooling & scripts

- **Candid / DID:** `npm run did` updates declarations via
  [`scripts/did.sh`](../../scripts/did.sh). Commit
  `src/declarations/**` together with the FE wiring change.
- **Canister management:** [`dfx.json`](../../dfx.json) points at
  `scripts/build/` for WASM build hooks; shared helpers live in
  `scripts/lib/`; post-deploy calls live in `scripts/init/`.
- **dfx:** `npm run deploy` for local / mainnet canister deployment.

## Best practices

- **Type safety.** Always use the generated Candid types from
  `$declarations/<canister>/<canister>.did`.
- **Error handling.** Use the patterns established in the API services
  (return typed results; surface user errors via `notification.store`).
- **Cross-repo PRs.** If you need a new method, add it in
  `../icdc-core/` first, regenerate bindings here via `npm run did`,
  and reference the upstream PR / commit in your PR's `# Motivation`.
  See
  [`docs/ai/pr-and-ci.md#9-cross-repo-changes-icdc-core`](../../docs/ai/pr-and-ci.md#9-cross-repo-changes-icdc-core).

## Day-2 ops

For grant / revoke / audit / kill-switch / rotate engine admins, see:

- [`.agents/workflows/icdc-engine-operations.md`](../../.agents/workflows/icdc-engine-operations.md)
- [`.agents/workflows/icdc-engine-reset.md`](../../.agents/workflows/icdc-engine-reset.md)
