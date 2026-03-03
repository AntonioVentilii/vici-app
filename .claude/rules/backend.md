# Backend & Canister Integration

## Overview

Vici interacts with several canisters on the Internet Computer:

- **Clearing Canister**: Core logic for predictions and resolutions.
- **Registry Canister**: Manages series and market metadata.
- **ICRC Ledger**: ICP and ckUSDC token operations.

## Architecture

- **API Layer**: Logic lives in `@src/lib/api/`. Use the established API classes for all canister interactions.
- **Mocking**: During development/migration, follow patterns in `mockBackend.ts`.

## Tooling & Scripts

- **Candid/DID**: Run `npm run did` to update declarations. This executes `@scripts/did.sh`.
- **Canister Management**: Use scripts in `@scripts/` for building WASMs, importing Candid files, and downloading immutable assets.
- **DFX**: Use `npm run deploy` for local/mainnet canister deployment via `dfx.json`.

## Best Practices

- **Type Safety**: Always use the generated Candid types from `@src/declarations/`.
- **Error Handling**: Use the error handling patterns established in the API services.
