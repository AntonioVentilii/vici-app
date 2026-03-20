#!/usr/bin/env bash

source "$(dirname "$0")/utils.sh" "$@"

echo "Starting clearing initialization on $NETWORK..."

REGISTRY=$(dfx canister id registry --network "$NETWORK")

LEDGER=$(dfx canister id ledger --network "$NETWORK")

ICP_LEDGER="ryjl3-tyaaa-aaaaa-aaaba-cai"

echo "Setting registry canister ID $REGISTRY in clearing canister..."
dfx canister call --network "$NETWORK" clearing set_registry_canister "(principal \"$REGISTRY\")"

echo "Registering ICDC ledger $LEDGER as collateral asset in clearing canister..."
dfx canister call --network "$NETWORK" clearing register_icrc_asset "(record {
    asset_id = \"vusd\";
    ledger_id = principal \"$LEDGER\";
    haircut_bps = 0 : nat16;
    is_enabled = true;
    oracle_id = null;
})"

echo "Registering ICP ledger $ICP_LEDGER as collateral asset in clearing canister..."
dfx canister call --network "$NETWORK" clearing register_icrc_asset "(record {
    asset_id = \"icp\";
    ledger_id = principal \"$ICP_LEDGER\";
    haircut_bps = 1_000 : nat16;
    is_enabled = true;
    oracle_id = null;
})"

echo "Setting asset metrics for ICP ledger $ICP_LEDGER in clearing canister..."
dfx canister call --network "$NETWORK" clearing update_asset_metrics "(record {
    asset_id = \"icp\";
    metrics = record {
      haircut_bps = 1_000 : nat16;
      latest_transfer_fee = null;
      insurance_fee_ratio = null;
      last_updated_ns = null;
      protocol_fee_ratio = null;
      price_usd = record { decimals = 2 : nat8; value = 300 : nat };
    };
})"

echo "Clearing initialization complete."
