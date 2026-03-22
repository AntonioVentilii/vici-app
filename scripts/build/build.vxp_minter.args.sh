#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

ARGS_FILE="$(jq -re .canisters.vxp_minter.init_arg_file "$PROJECT_ROOT/dfx.json")"
LEDGER_PRINCIPAL="${CANISTER_ID_VXP_LEDGER:-$(dfx canister id vxp_ledger --network "$NETWORK")}"

mkdir -p "$PROJECT_ROOT/$(dirname "$ARGS_FILE")"

cat <<EOF >"$PROJECT_ROOT/$ARGS_FILE"
(
  variant {
    Init = record {
      ledger_id = principal "$LEDGER_PRINCIPAL"
    }
  }
)
EOF
