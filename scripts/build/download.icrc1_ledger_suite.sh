#!/usr/bin/env bash
set -euo pipefail

_DLD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${PROJECT_ROOT:-}" ]]; then
	source "$_DLD_DIR/../lib/utils.sh"
fi

DIR="$PROJECT_ROOT/target/ic"
mkdir -p "$DIR"

LEDGER_SUITE_TAG="ledger-suite-icrc-2025-06-19"
BASE="https://github.com/dfinity/ic/releases/download/${LEDGER_SUITE_TAG}"

"$SCRIPTS_LIB/download-immutable.sh" "${BASE}/ic-icrc1-ledger.wasm.gz" "$DIR/ic-icrc1-ledger.wasm.gz"
gunzip -f "$DIR/ic-icrc1-ledger.wasm.gz"

"$SCRIPTS_LIB/download-immutable.sh" "${BASE}/ic-icrc1-index-ng.wasm.gz" "$DIR/ic-icrc1-index-ng.wasm.gz"
gunzip -f "$DIR/ic-icrc1-index-ng.wasm.gz"

"$SCRIPTS_LIB/download-immutable.sh" "${BASE}/ledger.did" "$DIR/icrc1_ledger.did"
"$SCRIPTS_LIB/download-immutable.sh" "${BASE}/index-ng.did" "$DIR/icrc1_index.did"
