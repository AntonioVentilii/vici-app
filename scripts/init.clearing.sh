#!/usr/bin/env bash

source "$(dirname "$0")/utils.sh" "$@"

echo "Starting clearing initialization on $NETWORK..."

# 1. Set Registry Canister
REGISTRY=$(dfx canister id registry --network "$NETWORK")
echo "Setting registry canister ID $REGISTRY in clearing canister..."
dfx canister call clearing set_registry_canister "(principal \"$REGISTRY\")" --network "$NETWORK"

# 1b. Domain policies (Settlement + Playground)
echo "Configuring balance domain policies (Settlement, Playground)..."
dfx canister call clearing update_domain_policy "(record {
  domain = variant { Settlement };
  policy = record {
    deposits_enabled = true;
    protocol_fee_ratio_override = null;
    label = \"Settlement\";
    withdrawals_enabled = true;
    insurance_fund_fee_ratio_override = null;
  };
})" --network "$NETWORK"

dfx canister call clearing update_domain_policy "(record {
  domain = variant { Playground };
  policy = record {
    deposits_enabled = true;
    protocol_fee_ratio_override = null;
    label = \"Playground\";
    withdrawals_enabled = true;
    insurance_fund_fee_ratio_override = null;
  };
})" --network "$NETWORK"

# 2. Register Collateral Assets
# Definitions for allowed domains
CLEARING_DOMAINS_PLAYGROUND="vec { variant { Playground } }"
CLEARING_DOMAINS_SETTLEMENT="vec { variant { Settlement } }"
CLEARING_DOMAINS_ALL="vec { variant { Playground }; variant { Settlement } }"

# Asset IDs and Ledger IDs
ICP_LEDGER="ryjl3-tyaaa-aaaaa-aaaba-cai"
TESTICP_LEDGER="xafvr-biaaa-aaaai-aql5q-cai"
TICRC1_LEDGER="3jkp5-oyaaa-aaaaj-azwqa-cai"
VUSD_LEDGER=$(dfx canister id ledger --network "$NETWORK" 2>/dev/null || echo "5uhob-dyaaa-aaaaj-qqwwa-cai")

USD_DECIMALS=4

# Register ICP (Settlement only)
echo "Registering ICP collateral asset (domains: Settlement)..."
dfx canister call clearing register_icrc_asset "(record { 
    asset_id = \"icp\"; 
    ledger_id = principal \"$ICP_LEDGER\";
    haircut_bps = 1000 : nat16;
    oracle_id = null;
    is_enabled = true;
    allowed_balance_domains = $CLEARING_DOMAINS_SETTLEMENT;
})" --network "$NETWORK"

dfx canister call clearing update_asset_price "(record { 
    asset_id = \"icp\"; 
    price = record { decimal = record { value = 30000 : nat; decimals = $USD_DECIMALS : nat8 }; oracle_id = null; timestamp = null };
})" --network "$NETWORK"

# 4. Add Clearing as controller of vUSD Ledger
echo "Guaranteeing Clearing canister as controller of vUSD Ledger..."
CLEARING_CANISTER=$(dfx canister id clearing --network "$NETWORK")
CURRENT_CONTROLLERS=$(dfx canister status "$VUSD_LEDGER" --network "$NETWORK" 2>&1 | grep "Controllers:" | cut -d: -f2 || echo "")
if [[ ! "$CURRENT_CONTROLLERS" == *"$CLEARING_CANISTER"* ]]; then
  echo "Adding $CLEARING_CANISTER as controller to $VUSD_LEDGER..."
  dfx canister update-settings "$VUSD_LEDGER" --network "$NETWORK" --add-controller "$CLEARING_CANISTER" || echo "Warning: Could not add controller. This might be expected if you are not a controller yourself."
fi

echo "Clearing initialization complete."
