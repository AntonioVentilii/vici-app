#!/usr/bin/env bash
set -euo pipefail

WASM_FILE="$(jq -re .canisters.registry.wasm dfx.json)"

mkdir -p "$(dirname "$WASM_FILE")"

./scripts/download.icdc.registry.sh
