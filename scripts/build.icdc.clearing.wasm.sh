#!/usr/bin/env bash
set -euo pipefail

WASM_FILE="$(jq -re .canisters.clearing.wasm dfx.json)"

mkdir -p "$(dirname "$WASM_FILE")"

./scripts/download.icdc.clearing.sh
