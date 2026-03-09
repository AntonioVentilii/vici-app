#!/usr/bin/env bash
set -euo pipefail

PRINCIPAL="$(dfx identity get-principal)"
ARG_FILE="$(jq -re .canisters.ledger.init_arg_file dfx.json)"

mkdir -p "$(dirname "$ARG_FILE")"

cat <<-EOF >"$ARG_FILE"
(
  variant {
    Init = record {
      token_symbol = "vUSD";
      token_name = "Virtual USD";
      transfer_fee = 100_000;
      decimals = opt 8;
      feature_flags = opt record {
        icrc2 = true
      };
      minting_account = record {
        owner = principal "$CANISTER_ID_MINTER"
      };
      metadata = vec {};
      initial_balances = vec {};
      archive_options = record {
        num_blocks_to_archive = 1_000;
        trigger_threshold = 2_000;
        controller_id = principal "$PRINCIPAL";
        cycles_for_archive_creation = opt 10_000_000_000_000
      }
    }
  }
)
EOF
