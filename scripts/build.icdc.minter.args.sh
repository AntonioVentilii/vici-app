#!/usr/bin/env bash
set -euxo pipefail

source "$(dirname "$0")/utils.sh" "$@"

ARGS_FILE="$(jq -re .canisters.minter.init_arg_file "$PROJECT_ROOT/dfx.json")"
mkdir -p "$PROJECT_ROOT/$(dirname "$ARGS_FILE")"

mkdir -p "$PROJECT_ROOT/target/icdc"
cat <<EOF >"$PROJECT_ROOT/$ARGS_FILE"
(
  record {
    authorized_callers = vec {
      principal "$CANISTER_ID_CLEARING";
      principal "fi5zj-aw22p-wi734-xvevg-m74nl-hv4m7-x6p5d-nzdid-eafyu-retk2-nqe";
    };
    ledger_canister = principal "$CANISTER_ID_LEDGER";
  }
)
EOF
