#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/../lib/utils.sh" "$@"

WASM_FILE="$(jq -re .canisters.clearing.wasm "$PROJECT_ROOT/dfx.json")"

mkdir -p "$PROJECT_ROOT/$(dirname "$WASM_FILE")"

"$BUILD_SCRIPTS_DIR/download.icdc.clearing.sh"
