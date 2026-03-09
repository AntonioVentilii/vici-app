#!/usr/bin/env bash

set -euo pipefail

echo "Starting clearing initialization..."

REGISTRY=$(dfx canister id registry)

LEDGER=$(dfx canister id ledger)

echo "Setting registry canister ID $REGISTRY in clearing canister..."
dfx canister call --network local clearing set_registry_canister "(principal \"$REGISTRY\")"

echo "Adding ICDC ledger $LEDGER as collateral asset in clearing canister..."
dfx canister call --network local clearing update_collateral_asset "(record {
    config = record {
        asset_id = \"vusd\";
        symbol = \"vUSD\";
        decimals = 8 : nat8;
        is_enabled = true;
        oracle_id = null;
        asset = variant { Icrc = principal \"$LEDGER\" };
    }
})"

echo "Clearing initialization complete."
