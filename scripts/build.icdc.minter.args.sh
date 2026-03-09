#!/usr/bin/env bash
set -euxo pipefail

ARGS_FILE="$(jq -re .canisters.minter.init_arg_file dfx.json)"
mkdir -p "$(dirname "$ARGS_FILE")"

mkdir -p target/icdc
cat <<EOF >"$ARGS_FILE"
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
