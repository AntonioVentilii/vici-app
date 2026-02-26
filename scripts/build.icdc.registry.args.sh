#!/usr/bin/env bash
set -euxo pipefail

ARGS_FILE="$(jq -re .canisters.registry.init_arg_file dfx.json)"
mkdir -p "$(dirname "$ARGS_FILE")"

mkdir -p target/icdc
cat <<EOF >"$ARGS_FILE"
  (
  )
EOF
