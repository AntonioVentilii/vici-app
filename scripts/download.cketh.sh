#!/bin/bash

# Download ckETH

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DIR="$PROJECT_ROOT/target/ic"

mkdir -p "$DIR"

IC_COMMIT="03dd6ee6de80c2202f66948692c69c61eb6af54d"

"$SCRIPT_DIR/download-immutable.sh" "https://download.dfinity.systems/ic/$IC_COMMIT/canisters/ic-cketh-minter.wasm.gz" "$DIR"/cketh_minter.wasm.gz
gunzip -f "$DIR"/cketh_minter.wasm.gz

# ckETH requires special ledger and index to handle 18 decimals, therefore the special wasm
"$SCRIPT_DIR/download-immutable.sh" "https://download.dfinity.systems/ic/$IC_COMMIT/canisters/ic-icrc1-ledger-u256.wasm.gz" "$DIR"/cketh_ledger.wasm.gz
gunzip -f "$DIR"/cketh_ledger.wasm.gz

"$SCRIPT_DIR/download-immutable.sh" "https://download.dfinity.systems/ic/$IC_COMMIT/canisters/ic-icrc1-index-ng-u256.wasm.gz" "$DIR"/cketh_index.wasm.gz
gunzip -f "$DIR"/cketh_index.wasm.gz

"$SCRIPT_DIR/download-immutable.sh" "https://raw.githubusercontent.com/dfinity/ic/$IC_COMMIT/rs/ethereum/cketh/minter/cketh_minter.did" "$DIR"/cketh_minter.did

"$SCRIPT_DIR/download-immutable.sh" "https://raw.githubusercontent.com/dfinity/ic/$IC_COMMIT/rs/ledger_suite/icrc1/ledger/ledger.did" "$DIR"/cketh_ledger.did

"$SCRIPT_DIR/download-immutable.sh" "https://raw.githubusercontent.com/dfinity/ic/$IC_COMMIT/rs/ledger_suite/icrc1/index-ng/index-ng.did" "$DIR"/cketh_index.did
