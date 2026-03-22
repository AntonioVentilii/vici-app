#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

ARGS_FILE="$(jq -re .canisters.vxp_index.init_arg_file "$PROJECT_ROOT/dfx.json")"

mkdir -p "$PROJECT_ROOT/$(dirname "$ARGS_FILE")"

cat <<EOF >"$PROJECT_ROOT/$ARGS_FILE"
(opt variant {
  Init = record {
    ledger_id = principal "$CANISTER_ID_VXP_LEDGER";
  }
})
EOF
