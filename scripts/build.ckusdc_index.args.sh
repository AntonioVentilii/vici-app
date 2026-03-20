#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/utils.sh" "$@"

ARGS_FILE="$(jq -re .canisters.ckusdc_index.init_arg_file "$PROJECT_ROOT/dfx.json")"

mkdir -p "$PROJECT_ROOT/$(dirname "$ARGS_FILE")"
mkdir -p "$PROJECT_ROOT/target/icdc"
cat <<EOF >"$PROJECT_ROOT/$ARGS_FILE"
(opt variant {
  Init = record {
    ledger_id = principal "$CANISTER_ID_CKUSDC_LEDGER";
   }
})
EOF
