#!/usr/bin/env bash
set -euxo pipefail

source "$(dirname "$0")/utils.sh" "$@"

LEDGER_CANISTER_ID=$(dfx canister id ledger --network "$NETWORK")

# Anonymous principal (placeholder until EVM / signer canisters are wired)
ANONYMOUS_PRINCIPAL="aaaaa-aa"

# Configurable values
CLEARING_INSURANCE_FEE_BPS="${CLEARING_INSURANCE_FEE_BPS:-10}"
CLEARING_PROTOCOL_FEE_BPS="${CLEARING_PROTOCOL_FEE_BPS:-5}"
CLEARING_VERSION="${CLEARING_VERSION:-1}"
CLEARING_EVM_RPC_PRINCIPAL="${CLEARING_EVM_RPC_PRINCIPAL:-$ANONYMOUS_PRINCIPAL}"
CLEARING_SIGNER_PRINCIPAL="${CLEARING_SIGNER_PRINCIPAL:-$ANONYMOUS_PRINCIPAL}"
CLEARING_INTERNAL_ASSET_ID="${CLEARING_INTERNAL_ASSET_ID:-vUSD}"
CLEARING_INTERNAL_SYMBOL="${CLEARING_INTERNAL_SYMBOL:-vUSD}"
CLEARING_INTERNAL_DECIMALS="${CLEARING_INTERNAL_DECIMALS:-8}"

ARGS_FILE="$(jq -re .canisters.clearing.init_arg_file "$PROJECT_ROOT/dfx.json")"
mkdir -p "$PROJECT_ROOT/$(dirname "$ARGS_FILE")"

echo "Building clearing init args for network=$NETWORK (ledger=$LEDGER_CANISTER_ID) -> $ARGS_FILE"

mkdir -p "$PROJECT_ROOT/target/icdc"
cat <<EOF >"$PROJECT_ROOT/$ARGS_FILE"
(
  record {
    insurance_fund_fee_ratio = $CLEARING_INSURANCE_FEE_BPS : nat16;
    internal_ledger = record {
      decimals = $CLEARING_INTERNAL_DECIMALS : nat8;
      asset = variant { Icrc = principal "$LEDGER_CANISTER_ID" };
      is_enabled = true;
      allowed_balance_domains = vec { variant { Settlement }; variant { Playground } };
      oracle_id = null;
      asset_id = "$CLEARING_INTERNAL_ASSET_ID";
      symbol = "$CLEARING_INTERNAL_SYMBOL";
    };
    signer_canister = principal "$CLEARING_SIGNER_PRINCIPAL";
    version = $CLEARING_VERSION : nat32;
    evm_rpc = principal "$CLEARING_EVM_RPC_PRINCIPAL";
    protocol_fee_ratio = $CLEARING_PROTOCOL_FEE_BPS : nat16;
  }
)
EOF
