#!/usr/bin/env bash

source "$(dirname "$0")/utils.sh" "$@"

echo "Starting clearing initialization on $NETWORK..."

REGISTRY=$(dfx canister id registry --network "$NETWORK")

LEDGER=$(dfx canister id ledger --network "$NETWORK")

ICP_LEDGER="ryjl3-tyaaa-aaaaa-aaaba-cai"

echo "Setting registry canister ID $REGISTRY in clearing canister..."
dfx canister call --network "$NETWORK" clearing set_registry_canister "(principal \"$REGISTRY\")"

echo "Adding ICDC ledger $LEDGER as collateral asset in clearing canister..."
dfx canister call --network "$NETWORK" clearing update_collateral_asset "(record {
    config = record {
        asset_id = \"vusd\";
        symbol = \"vUSD\";
        decimals = 8 : nat8;
        is_enabled = true;
        oracle_id = null;
        asset = variant { Icrc = principal \"$LEDGER\" };
    }
})"

echo "Adding ICP ledger $ICP_LEDGER as collateral asset in clearing canister..."
dfx canister call --network "$NETWORK" clearing update_collateral_asset "(record {
    config = record {
        asset_id = \"icp\";
        symbol = \"ICP\";
        decimals = 8 : nat8;
        is_enabled = true;
        oracle_id = null;
        asset = variant { Icrc = principal \"$ICP_LEDGER\" };
    }
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
