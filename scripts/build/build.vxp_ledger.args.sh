#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

PRINCIPAL="$(dfx identity get-principal)"
ARGS_FILE="$(jq -re .canisters.vxp_ledger.init_arg_file "$PROJECT_ROOT/dfx.json")"
MINTER_PRINCIPAL="${CANISTER_ID_VXP_MINTER:-$(dfx canister id vxp_minter --network "$NETWORK")}"

mkdir -p "$PROJECT_ROOT/$(dirname "$ARGS_FILE")"

# 4 decimals: 1,000 VXP for local testing
INITIAL_UNITS='10_000_000'

cat <<EOF >"$PROJECT_ROOT/$ARGS_FILE"
(variant {
  Init = record {
    token_symbol = "VXP";
    token_name = "Vici XP";
    decimals = opt 4;
    max_memo_length = opt 80;
    minting_account = record { owner = principal "$MINTER_PRINCIPAL" };
    transfer_fee = 1;
    metadata = vec {};
    initial_balances = vec {
      record { record { owner = principal "$PRINCIPAL"; }; $INITIAL_UNITS; };
    };
    archive_options = record {
      num_blocks_to_archive = 10_000;
      trigger_threshold = 20_000;
      controller_id = principal "$PRINCIPAL";
      cycles_for_archive_creation = opt 1_000_000_000_000;
      max_message_size_bytes = null;
      node_max_memory_size_bytes = opt 3_221_225_472;
    };
    feature_flags = opt record { icrc2 = true; icrc3 = true };
  }
})
EOF
