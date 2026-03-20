#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/utils.sh" "$@"

WASM_FILE="$(jq -re .canisters.clearing.wasm "$PROJECT_ROOT/dfx.json")"

mkdir -p "$PROJECT_ROOT/$(dirname "$WASM_FILE")"

"$SCRIPT_DIR/download.icdc.clearing.sh"
